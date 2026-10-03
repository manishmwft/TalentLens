import { Interview } from '../models/Interview.js';
import { InterviewAttempt } from '../models/InterviewAttempt.js';
import { InterviewAnswer } from '../models/InterviewAnswer.js';
import { CandidateEvent } from '../models/CandidateEvent.js';
import { AppError } from '../utils/AppError.js';

const WEIGHTS = Object.freeze({
  technical: 0.35,
  coverage: 0.25,
  communication: 0.15,
  relevance: 0.15,
  resumeAlignment: 0.10,
});

const INTEGRITY_WEIGHTS = Object.freeze({
  tab_hidden: 3,
  window_blur: 2,
  window_focus: 0,
  inactivity: 4,
  camera_disabled: 8,
  microphone_disabled: 8,
  no_face: 10,
  multiple_faces: 15,
  network_disconnected: 2,
  network_reconnected: 0,
  multiple_login: 20,
});

const round = (value) => Math.round(Number(value || 0));
const avg = (values) => {
  const list = values.map(Number).filter(Number.isFinite);
  return list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : 0;
};
const unique = (values, limit = 12) =>
  [...new Set(values.flat().map((v) => String(v || '').trim()).filter(Boolean))].slice(0, limit);

function recommendation(score) {
  if (score >= 85) return 'strong_hire';
  if (score >= 70) return 'hire';
  if (score >= 55) return 'hold';
  return 'no_hire';
}

function summarizeIntegrity(events = []) {
  const counts = {};
  let riskScore = 0;
  for (const event of events) {
    const type = String(event?.type || '');
    if (!type) continue;
    counts[type] = (counts[type] || 0) + 1;
    riskScore += INTEGRITY_WEIGHTS[type] || 0;
  }
  riskScore = Math.min(100, riskScore);
  return {
    totalEvents: events.length,
    counts,
    riskScore,
    riskLevel: riskScore >= 60 ? 'high' : riskScore >= 25 ? 'moderate' : 'low',
    requiresAttention: riskScore >= 25,
  };
}

export async function calculateFinalAutomatedInterviewEvaluation(interviewId, { force = false } = {}) {
  const interview = await Interview.findById(interviewId)
    .populate('candidate', 'analysis workflowStatus')
    .populate('screening', 'jobDescription');

  if (!interview) throw new AppError('Interview not found', 404);
  if (interview.deliveryMode !== 'automated_ai') {
    throw new AppError('Final automated scoring is available only for automated AI interviews.', 409);
  }

  const attempt = await InterviewAttempt.findOne({ interview: interview._id })
    .sort({ attemptNumber: -1 });
  if (!attempt) throw new AppError('Candidate interview attempt not found', 409);

  const answers = await InterviewAnswer.find({
    interview: interview._id,
    attempt: attempt._id,
  }).sort({ order: 1 });

  const totalQuestions = interview.questions?.length || 0;
  const completed = answers.filter(
    (a) => a.transcription?.status === 'completed' && a.evaluation?.status === 'completed',
  );

  if (!force && totalQuestions > 0 && completed.length < totalQuestions) {
    return {
      ready: false, interview, attempt, totalQuestions,
      evaluatedCount: completed.length,
      pendingCount: Math.max(0, totalQuestions - completed.length),
    };
  }
  if (!completed.length) {
    throw new AppError('No completed answer evaluations are available for final scoring.', 409);
  }

  const technicalScore = round(avg(completed.map((a) => a.evaluation.technicalCorrectness)));
  const coverageScore = round(avg(completed.map((a) => a.evaluation.coverageScore)));
  const communicationScore = round(avg(completed.map((a) => a.evaluation.communicationClarity)));
  const relevanceScore = round(avg(completed.map((a) => a.evaluation.relevanceScore)));
  const resumeAlignmentScore = Math.max(0, Math.min(100, Number(interview.candidate?.analysis?.matchScore || 0)));

  const problemAnswers = completed.filter((a) => {
    const category = String(a.questionSnapshot?.category || '').toLowerCase();
    return ['problem','scenario','situational','technical','project','coding']
      .some((word) => category.includes(word));
  });
  const problemSolvingScore = round(avg(
    (problemAnswers.length ? problemAnswers : completed).map((a) =>
      (Number(a.evaluation.coverageScore || 0) +
       Number(a.evaluation.relevanceScore || 0) +
       Number(a.evaluation.technicalCorrectness || 0)) / 3),
  ));
  const roleFitScore = round(relevanceScore * .5 + coverageScore * .3 + resumeAlignmentScore * .2);
  const overallScore = round(
    technicalScore * WEIGHTS.technical +
    coverageScore * WEIGHTS.coverage +
    communicationScore * WEIGHTS.communication +
    relevanceScore * WEIGHTS.relevance +
    resumeAlignmentScore * WEIGHTS.resumeAlignment
  );

  const resultRecommendation = recommendation(overallScore);
  const integrity = summarizeIntegrity(attempt.integrityEvents);
  const strengths = unique(completed.map((a) => a.evaluation.strengths || []));
  const concerns = unique([
    ...completed.map((a) => a.evaluation.concerns || []),
    ...(integrity.requiresAttention
      ? [`Integrity monitoring requires review (${integrity.riskLevel} risk, ${integrity.totalEvents} event(s)).`]
      : []),
  ]);

  attempt.finalEvaluation.status = 'ready_for_review';
  Object.assign(attempt.finalEvaluation, {
    overallScore,
    technicalScore,
    coverageScore,
    communicationScore,
    relevanceScore,
    problemSolvingScore,
    roleFitScore,
    resumeAlignmentScore,
    recommendation: resultRecommendation,
    strengths,
    concerns,
    summary:
      `The candidate achieved ${overallScore}% across ${completed.length} evaluated response(s). ` +
      `The advisory recommendation is ${resultRecommendation.replaceAll('_',' ')}. ` +
      `Integrity monitoring is classified as ${integrity.riskLevel} risk. Staff review is required.`,
    provider: 'calculated_from_answer_evaluations',
    model: completed.find((a) => a.evaluation.model)?.evaluation.model || '',
    answerCount: answers.length,
    evaluatedAnswerCount: completed.length,
    weights: WEIGHTS,
    integritySummary: integrity,
    evaluatedAt: new Date(),
  });
  attempt.finalEvaluation.staffReview.status = 'pending';
  attempt.finalEvaluation.staffReview.reviewedAt = null;
  attempt.finalEvaluation.staffReview.reviewedBy = null;
  attempt.finalEvaluation.staffReview.notes = '';
  attempt.finalEvaluation.staffReview.adjustedOverallScore = null;
  attempt.finalEvaluation.staffReview.adjustedRecommendation = '';
  await attempt.save();

  if (attempt.status === 'processing') {
    attempt.status = 'completed';
    await attempt.save();
  }

  await CandidateEvent.create({
    organization: interview.organization,
    candidate: interview.candidate._id,
    screening: interview.screening?._id || interview.screening,
    interview: interview._id,
    type: 'automated_interview_scored',
    message: `Automated interview scored ${overallScore}% and is ready for staff review.`,
    occurredAt: new Date(),
    metadata: {
      overallScore,
      recommendation: resultRecommendation,
      integrityRisk: integrity.riskLevel,
      attemptId: attempt._id,
    },
  }).catch(() => null);

  return {
    ready: true, interview, attempt, totalQuestions,
    evaluatedCount: completed.length,
    pendingCount: Math.max(0, totalQuestions - completed.length),
  };
}

export async function reviewFinalAutomatedInterviewEvaluation({
  interviewId, organizationId, reviewer, payload,
}) {
  const interview = await Interview.findOne({
    _id: interviewId,
    organization: organizationId,
    deliveryMode: 'automated_ai',
  });
  if (!interview) throw new AppError('Automated interview not found', 404);

  const attempt = await InterviewAttempt.findOne({
    interview: interview._id,
    organization: organizationId,
  }).sort({ attemptNumber: -1 });
  if (!attempt?.finalEvaluation?.evaluatedAt) {
    throw new AppError('Final automated evaluation is not ready for staff review.', 409);
  }

  const adjustedScore =
    payload.adjustedOverallScore === null || payload.adjustedOverallScore === undefined
      ? null : Number(payload.adjustedOverallScore);
  const finalScore = adjustedScore === null
    ? attempt.finalEvaluation.overallScore : adjustedScore;
  const finalRecommendation =
    payload.adjustedRecommendation || attempt.finalEvaluation.recommendation;

  attempt.finalEvaluation.status = 'reviewed';
  Object.assign(attempt.finalEvaluation.staffReview, {
    status: 'approved',
    reviewedAt: new Date(),
    reviewedBy: reviewer._id,
    notes: payload.notes || '',
    adjustedOverallScore: adjustedScore,
    adjustedRecommendation: payload.adjustedRecommendation || '',
  });
  attempt.finalEvaluation.staffReviewedAt = new Date();
  attempt.finalEvaluation.staffReviewedBy = reviewer._id;
  await attempt.save();

  interview.status = 'completed';
  interview.completedAt = interview.completedAt || new Date();
  await interview.save();

  await CandidateEvent.create({
    organization: interview.organization,
    candidate: interview.candidate,
    screening: interview.screening,
    interview: interview._id,
    actor: reviewer._id,
    actorRole: reviewer.role,
    type: 'automated_interview_reviewed',
    message:
      `Automated interview approved with final score ${finalScore}% and ` +
      `recommendation ${finalRecommendation.replaceAll('_',' ')}.`,
    occurredAt: new Date(),
    metadata: {
      calculatedScore: attempt.finalEvaluation.overallScore,
      finalScore,
      calculatedRecommendation: attempt.finalEvaluation.recommendation,
      finalRecommendation,
      notes: payload.notes || '',
      attemptId: attempt._id,
    },
  }).catch(() => null);

  return attempt;
}
