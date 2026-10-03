import { api } from './api.js';

export async function getInterviewers() {
  const { data } = await api.get('/interviews/interviewers');
  return data.interviewers;
}
export async function assignInterview(screeningId, candidateId, payload) {
  const { data } = await api.post(`/interviews/${screeningId}/candidates/${candidateId}`, payload);
  return data.interview;
}
export async function getInterviews() {
  const { data } = await api.get('/interviews');
  return data.interviews;
}
export async function getInterview(interviewId) {
  const { data } = await api.get(`/interviews/${interviewId}`);
  return data.interview;
}
export async function updateInterviewStatus(interviewId, status) {
  const { data } = await api.patch(`/interviews/${interviewId}/status`, { status });
  return data.interview;
}
export async function generateInterviewQuestions(interviewId, payload) {
  const { data } = await api.post(`/interviews/${interviewId}/questions/generate`, payload, { timeout: 180000 });
  return data.interview;
}
export async function addInterviewQuestion(interviewId, payload) {
  const { data } = await api.post(`/interviews/${interviewId}/questions`, payload);
  return data.interview;
}
export async function updateInterviewQuestion(interviewId, questionId, payload) {
  const { data } = await api.patch(`/interviews/${interviewId}/questions/${questionId}`, payload);
  return data.interview;
}
export async function saveInterviewQuestionResponse(interviewId, questionId, payload) {
  const { data } = await api.put(`/interviews/${interviewId}/questions/${questionId}/response`, payload);
  return data.interview;
}
export async function evaluateInterviewQuestionAnswer(interviewId, questionId, candidateAnswer) {
  const { data } = await api.post(
    `/interviews/${interviewId}/questions/${questionId}/evaluate`,
    { candidateAnswer },
    { timeout: 180000 },
  );
  return data.interview;
}
export async function submitInterviewFinalFeedback(interviewId, payload) {
  const { data } = await api.post(`/interviews/${interviewId}/final-feedback`, payload);
  return data.interview;
}
export async function deleteInterviewQuestion(interviewId, questionId) {
  const { data } = await api.delete(`/interviews/${interviewId}/questions/${questionId}`);
  return data.interview;
}
export async function reorderInterviewQuestions(interviewId, questionIds) {
  const { data } = await api.put(`/interviews/${interviewId}/questions/reorder`, { questionIds });
  return data.interview;
}


export async function retryInterviewAnswerTranscription(interviewId, answerId, { force = true, wait = false } = {}) {
  const { data } = await api.post(
    `/interviews/${interviewId}/answers/${answerId}/transcription/retry`,
    { force, wait },
    { timeout: 180000 },
  );
  return data;
}

export async function retryInterviewAnswerEvaluation(interviewId, answerId, { force = true, wait = true } = {}) {
  const { data } = await api.post(
    `/interviews/${interviewId}/answers/${answerId}/evaluation/retry`,
    { force, wait },
    { timeout: 180000 },
  );
  return data;
}

// Retry the stage that actually failed for each answer.
// - Missing/failed transcript -> retry Faster Whisper.
// - Completed transcript + missing/failed evaluation -> retry AI evaluation only.
export async function retryFailedInterviewAnswers(interview) {
  const interviewId = interview?._id || interview?.id;
  const answers = interview?.automatedAnswers || [];

  if (!interviewId) throw new Error('Interview identifier is missing.');

  const transcriptionRetries = answers.filter((answer) => {
    const answerId = answer?._id || answer?.id;
    if (!answerId) return false;
    return answer?.transcription?.status === 'failed';
  });

  const evaluationRetries = answers.filter((answer) => {
    const answerId = answer?._id || answer?.id;
    if (!answerId) return false;

    const hasTranscript =
      answer?.transcription?.status === 'completed' &&
      String(answer?.transcription?.text || '').trim();

    return hasTranscript && answer?.evaluation?.status !== 'completed';
  });

  if (!transcriptionRetries.length && !evaluationRetries.length) {
    return {
      success: true,
      queuedCount: 0,
      evaluationCount: 0,
      failedCount: 0,
      message: 'No failed or incomplete answers need retrying.',
    };
  }

  const transcriptionResults = await Promise.allSettled(
    transcriptionRetries.map((answer) =>
      retryInterviewAnswerTranscription(interviewId, answer._id || answer.id, {
        force: true,
        wait: false,
      }),
    ),
  );

  // Evaluation retries wait for the result so the recruiter can refresh the
  // interview immediately and calculate the final score when all are complete.
  const evaluationResults = [];
  for (const answer of evaluationRetries) {
    try {
      const value = await retryInterviewAnswerEvaluation(
        interviewId,
        answer._id || answer.id,
        { force: true, wait: true },
      );
      evaluationResults.push({ status: 'fulfilled', value });
    } catch (reason) {
      evaluationResults.push({ status: 'rejected', reason });
    }
  }

  const queuedCount = transcriptionResults.filter((r) => r.status === 'fulfilled').length;
  const evaluationCount = evaluationResults.filter((r) => r.status === 'fulfilled').length;
  const failedCount =
    transcriptionResults.filter((r) => r.status === 'rejected').length +
    evaluationResults.filter((r) => r.status === 'rejected').length;

  if (!queuedCount && !evaluationCount && failedCount) {
    const firstFailure = [...transcriptionResults, ...evaluationResults]
      .find((r) => r.status === 'rejected');
    throw firstFailure?.reason || new Error('Unable to retry failed answers.');
  }

  const parts = [];
  if (queuedCount) parts.push(`${queuedCount} transcription retry(s) queued`);
  if (evaluationCount) parts.push(`${evaluationCount} evaluation retry(s) completed`);
  if (failedCount) parts.push(`${failedCount} retry(s) failed`);

  return {
    success: failedCount === 0,
    queuedCount,
    evaluationCount,
    failedCount,
    message: `${parts.join(', ')}.`,
  };
}

export async function recalculateAutomatedInterviewResult(interviewId, force = false) {
  const { data } = await api.post(
    `/interviews/${interviewId}/automated-result/recalculate`,
    { force },
    { timeout: 180000 },
  );
  return data;
}

export async function approveAutomatedInterviewResult(interviewId, payload) {
  const { data } = await api.post(
    `/interviews/${interviewId}/automated-result/review`,
    payload,
  );
  return data;
}
