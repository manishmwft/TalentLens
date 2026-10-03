import { InterviewAnswer } from '../models/InterviewAnswer.js';
import {
  INTERVIEW_ANSWER_STATUSES,
} from '../constants/interview.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  processInterviewAnswerEvaluation,
  queueInterviewAnswerEvaluation,
} from '../services/interviewAnswerEvaluationProcessor.js';
import { env } from '../config/env.js';

async function findAnswer(req) {
  const answer = await InterviewAnswer.findOne({
    _id: req.params.answerId,
    interview: req.params.interviewId,
    organization: req.user.organization,
  });

  if (!answer) {
    throw new AppError('Interview answer not found', 404);
  }

  return answer;
}

export const retryAutomatedAnswerEvaluation = asyncHandler(
  async (req, res) => {
    const answer = await findAnswer(req);

    if (
      answer.transcription?.status !== 'completed' ||
      !String(answer.transcription?.text || '').trim()
    ) {
      throw new AppError(
        'The answer must have a completed transcript before evaluation.',
        409,
      );
    }

    if (
      answer.evaluation?.status === 'completed' &&
      !req.body.force
    ) {
      return res.json({
        success: true,
        message: 'Answer evaluation is already complete',
        evaluation: answer.evaluation,
      });
    }

    if (
      Number(answer.evaluation?.attempts || 0) >=
        env.answerEvaluationMaxAttempts &&
      !req.body.force
    ) {
      throw new AppError(
        'Maximum AI evaluation retry count reached. Use a forced retry only after fixing the provider configuration.',
        409,
      );
    }

    answer.status = INTERVIEW_ANSWER_STATUSES.EVALUATION_QUEUED;
    answer.evaluation.status = 'pending';
    answer.evaluation.error = '';
    answer.failureReason = '';
    await answer.save();

    if (req.body.wait === true) {
      const evaluated = await processInterviewAnswerEvaluation(
        answer._id,
      );

      return res.json({
        success: true,
        message: 'Answer evaluation completed',
        evaluation: evaluated.evaluation,
      });
    }

    queueInterviewAnswerEvaluation(answer._id);

    return res.status(202).json({
      success: true,
      message: 'Answer queued for AI evaluation',
      answerId: answer._id.toString(),
    });
  },
);
