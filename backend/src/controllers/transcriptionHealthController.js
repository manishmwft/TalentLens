import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import { checkFasterWhisperHealth } from '../services/transcription/fasterWhisperProvider.js';

export const getTranscriptionHealth = asyncHandler(
  async (_req, res) => {
    if (env.speechProvider !== 'faster_whisper') {
      return res.json({
        success: true,
        provider: env.speechProvider,
        message:
          'The active speech provider does not use the local faster-whisper service.',
      });
    }

    const health = await checkFasterWhisperHealth();

    return res.json({
      success: true,
      provider: env.speechProvider,
      health,
    });
  },
);
