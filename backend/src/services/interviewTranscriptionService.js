import path from 'path';
import { InterviewAnswer } from '../models/InterviewAnswer.js';
import {
  INTERVIEW_ANSWER_STATUSES,
} from '../constants/interview.js';
import { transcribeAudio } from './transcription/transcriptionService.js';
import { resolveStoredMedia } from './interviewMediaService.js';
import { env } from '../config/env.js';
import { queueInterviewAnswerEvaluation } from './interviewAnswerEvaluationProcessor.js';

const active = new Set();

function errorMessage(error) {
  return String(error?.message || 'Transcription failed').slice(0, 2000);
}

export async function processInterviewAnswerTranscription(answerId) {
  const key = String(answerId);
  if (active.has(key)) return null;
  active.add(key);

  try {
    const answer = await InterviewAnswer.findOneAndUpdate(
      {
        _id: answerId,
        'audio.filePath': { $ne: '' },
        'transcription.status': { $in: ['pending', 'failed'] },
      },
      {
        $set: {
          status: INTERVIEW_ANSWER_STATUSES.TRANSCRIBING,
          'transcription.status': 'processing',
          'transcription.error': '',
          'transcription.startedAt': new Date(),
        },
        $inc: {
          'transcription.attempts': 1,
        },
      },
      { new: true },
    );

    if (!answer) return null;

    try {
      const result = await transcribeAudio({
        filePath: resolveStoredMedia(answer.audio.filePath),
        mimeType: answer.audio.mimeType,
        durationSeconds: answer.audio.durationSeconds,
        languageCode: answer.transcription.language || env.googleSpeechLanguage,
      });

      answer.transcription.status = 'completed';
      answer.transcription.text = result.text;
      answer.transcription.provider = result.provider;
      answer.transcription.model = result.model;
      answer.transcription.language = result.language;
      answer.transcription.confidence = result.confidence;
      answer.transcription.error = '';
      answer.transcription.completedAt = new Date();
      answer.status = INTERVIEW_ANSWER_STATUSES.EVALUATION_QUEUED;
      answer.evaluation.status = 'pending';
      answer.evaluation.error = '';
      answer.failureReason = '';
      await answer.save();

      // Build 5.5G: begin evidence-based AI evaluation only after the
      // transcript has been safely persisted.
      queueInterviewAnswerEvaluation(answer._id);

      return answer;
    } catch (error) {
      answer.transcription.status = 'failed';
      answer.transcription.error = errorMessage(error);
      answer.transcription.completedAt = null;
      answer.status = INTERVIEW_ANSWER_STATUSES.FAILED;
      answer.failureReason = errorMessage(error);
      await answer.save();
      throw error;
    }
  } finally {
    active.delete(key);
  }
}

export function queueInterviewAnswerTranscription(answerId) {
  const id = String(answerId);

  setImmediate(() => {
    processInterviewAnswerTranscription(id).catch((error) => {
      console.error(`Transcription failed for answer ${id}:`, error.message);
    });
  });
}

export async function recoverQueuedTranscriptions() {
  if (!env.transcriptionAutoProcess) return;

  const staleBefore = new Date(
    Date.now() - env.transcriptionStaleMinutes * 60 * 1000,
  );

  // Recover jobs left in "processing" by an interrupted server.
  await InterviewAnswer.updateMany(
    {
      'transcription.status': 'processing',
      'transcription.startedAt': { $lt: staleBefore },
    },
    {
      $set: {
        status: INTERVIEW_ANSWER_STATUSES.QUEUED,
        'transcription.status': 'pending',
        'transcription.error':
          'Recovered after an interrupted transcription process.',
      },
    },
  );

  const queued = await InterviewAnswer.find({
    status: INTERVIEW_ANSWER_STATUSES.QUEUED,
    'audio.filePath': { $ne: '' },
    'transcription.status': { $in: ['pending', 'failed'] },
    'transcription.attempts': { $lt: env.transcriptionMaxAttempts },
  })
    .select('_id')
    .sort({ submittedAt: 1 })
    .limit(env.transcriptionRecoveryLimit);

  for (let index = 0; index < queued.length; index += 1) {
    const delay = Math.floor(index / env.transcriptionConcurrency) * 500;
    setTimeout(
      () => queueInterviewAnswerTranscription(queued[index]._id),
      delay,
    );
  }

  if (queued.length) {
    console.log(`Queued ${queued.length} interview answer(s) for transcription.`);
  }
}
