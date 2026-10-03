import { InterviewAnswer } from '../models/InterviewAnswer.js';
import { Interview } from '../models/Interview.js';
import {
  INTERVIEW_ANSWER_STATUSES,
} from '../constants/interview.js';
import { evaluateAutomatedInterviewAnswer } from './automatedAnswerEvaluationService.js';
import { env } from '../config/env.js';
import { calculateFinalAutomatedInterviewEvaluation } from './finalAutomatedInterviewEvaluationService.js';

const activeJobs = new Set();

function errorMessage(error) {
  return String(error?.message || 'Automated answer evaluation failed.')
    .slice(0, 2000);
}

function candidateSummary(candidate) {
  const analysis = candidate?.analysis || {};

  return [
    `Current role: ${analysis.currentRole || ''}`,
    `Experience: ${analysis.totalExperienceYears ?? ''}`,
    `Matched skills: ${(analysis.matchedSkills || []).join(', ')}`,
    `Missing skills: ${(analysis.missingSkills || []).join(', ')}`,
    `Strengths: ${(analysis.strengths || []).join('; ')}`,
    `Concerns: ${(analysis.concerns || []).join('; ')}`,
    `Resume summary: ${analysis.summary || ''}`,
  ]
    .filter((line) => !line.endsWith(': '))
    .join('\n');
}

export async function processInterviewAnswerEvaluation(answerId) {
  const key = String(answerId);

  if (activeJobs.has(key)) {
    return null;
  }

  activeJobs.add(key);

  try {
    const answer = await InterviewAnswer.findOneAndUpdate(
      {
        _id: answerId,
        'transcription.status': 'completed',
        'transcription.text': { $ne: '' },
        'evaluation.status': { $in: ['pending', 'failed'] },
      },
      {
        $set: {
          status: INTERVIEW_ANSWER_STATUSES.EVALUATING,
          'evaluation.status': 'processing',
          'evaluation.error': '',
          'evaluation.startedAt': new Date(),
        },
        $inc: {
          'evaluation.attempts': 1,
        },
      },
      { new: true },
    );

    if (!answer) {
      return null;
    }

    try {
      const interview = await Interview.findById(answer.interview)
        .populate('screening', 'jobDescription')
        .populate('candidate', 'analysis extractedText');

      if (!interview) {
        throw new Error('Interview not found for answer evaluation.');
      }

      const evaluation = await evaluateAutomatedInterviewAnswer({
        question: answer.questionSnapshot,
        transcript: answer.transcription.text,
        jobDescription: interview.screening?.jobDescription || '',
        candidateSummary: candidateSummary(interview.candidate),
      });

      answer.evaluation.status = 'completed';
      answer.evaluation.coverageScore =
        evaluation.result.coverageScore;
      answer.evaluation.technicalCorrectness =
        evaluation.result.technicalCorrectness;
      answer.evaluation.communicationClarity =
        evaluation.result.communicationClarity;
      answer.evaluation.relevanceScore =
        evaluation.result.relevanceScore;
      answer.evaluation.suggestedScore =
        evaluation.result.suggestedScore;
      answer.evaluation.coveredPoints =
        evaluation.result.coveredPoints;
      answer.evaluation.missingPoints =
        evaluation.result.missingPoints;
      answer.evaluation.strengths =
        evaluation.result.strengths;
      answer.evaluation.concerns =
        evaluation.result.concerns;
      answer.evaluation.feedback =
        evaluation.result.feedback;
      answer.evaluation.suggestedFollowUp =
        evaluation.result.suggestedFollowUp;
      answer.evaluation.provider = evaluation.provider;
      answer.evaluation.model = evaluation.model;
      answer.evaluation.error = '';
      answer.evaluation.completedAt = new Date();
      answer.evaluation.evaluatedAt = new Date();
      answer.status = INTERVIEW_ANSWER_STATUSES.COMPLETED;
      answer.failureReason = '';

      await answer.save();

      await calculateFinalAutomatedInterviewEvaluation(answer.interview)
        .catch((error) => {
          if (error.status !== 409) {
            console.error(
              `Unable to calculate final automated interview score for ${answer.interview}:`,
              error.message,
            );
          }
        });

      return answer;
    } catch (error) {
      answer.evaluation.status = 'failed';
      answer.evaluation.error = errorMessage(error);
      answer.evaluation.completedAt = null;
      answer.status = INTERVIEW_ANSWER_STATUSES.FAILED;
      answer.failureReason = errorMessage(error);
      await answer.save();
      throw error;
    }
  } finally {
    activeJobs.delete(key);
  }
}

export function queueInterviewAnswerEvaluation(answerId) {
  const id = String(answerId);

  setImmediate(() => {
    processInterviewAnswerEvaluation(id).catch((error) => {
      console.error(
        `Automated evaluation failed for answer ${id}:`,
        error.message,
      );
    });
  });
}

export async function recoverQueuedEvaluations() {
  if (!env.answerEvaluationAutoProcess) {
    return;
  }

  const staleBefore = new Date(
    Date.now() - env.answerEvaluationStaleMinutes * 60 * 1000,
  );

  await InterviewAnswer.updateMany(
    {
      'evaluation.status': 'processing',
      'evaluation.startedAt': { $lt: staleBefore },
    },
    {
      $set: {
        status: INTERVIEW_ANSWER_STATUSES.EVALUATION_QUEUED,
        'evaluation.status': 'pending',
        'evaluation.error':
          'Recovered after an interrupted AI evaluation process.',
      },
    },
  );

  const queuedAnswers = await InterviewAnswer.find({
    'transcription.status': 'completed',
    'transcription.text': { $ne: '' },
    'evaluation.status': { $in: ['pending', 'failed'] },
    'evaluation.attempts': {
      $lt: env.answerEvaluationMaxAttempts,
    },
  })
    .select('_id')
    .sort({ submittedAt: 1 })
    .limit(env.answerEvaluationRecoveryLimit);

  for (let index = 0; index < queuedAnswers.length; index += 1) {
    const delay =
      Math.floor(index / env.answerEvaluationConcurrency) * 750;

    setTimeout(
      () => queueInterviewAnswerEvaluation(queuedAnswers[index]._id),
      delay,
    );
  }

  if (queuedAnswers.length) {
    console.log(
      `Queued ${queuedAnswers.length} interview answer(s) for AI evaluation.`,
    );
  }
}
