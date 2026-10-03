import { InterviewAnswer } from '../models/InterviewAnswer.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  INTERVIEW_ANSWER_STATUSES,
} from '../constants/interview.js';
import {
  processInterviewAnswerTranscription,
  queueInterviewAnswerTranscription,
} from '../services/interviewTranscriptionService.js';
import { env } from '../config/env.js';

async function findAnswer(req) {
  const answer = await InterviewAnswer.findOne({
    _id: req.params.answerId,
    interview: req.params.interviewId,
    organization: req.user.organization,
  });

  if (!answer) throw new AppError('Interview answer not found', 404);
  return answer;
}

export const retryInterviewAnswerTranscription = asyncHandler(
  async (req, res) => {
    const answer = await findAnswer(req);

    if (!answer.audio?.filePath) {
      throw new AppError('Audio recording is not available', 409);
    }

    if (answer.transcription?.status === 'completed' && !req.body.force) {
      return res.json({
        success: true,
        message: 'Transcript is already complete',
        transcription: answer.transcription,
      });
    }

    if (
      Number(answer.transcription?.attempts || 0) >=
        env.transcriptionMaxAttempts &&
      !req.body.force
    ) {
      throw new AppError(
        'Maximum transcription retry count reached. Use a forced retry only after correcting the provider configuration.',
        409,
      );
    }

    answer.status = INTERVIEW_ANSWER_STATUSES.QUEUED;
    answer.transcription.status = 'pending';
    answer.transcription.error = '';
    answer.failureReason = '';
    await answer.save();

    if (req.body.wait === true) {
      const completed = await processInterviewAnswerTranscription(answer._id);
      return res.json({
        success: true,
        message: 'Transcription completed',
        transcription: completed.transcription,
      });
    }

    queueInterviewAnswerTranscription(answer._id);

    return res.status(202).json({
      success: true,
      message: 'Answer queued for transcription',
      answerId: answer._id.toString(),
    });
  },
);
