import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

export async function transcribeAudio(input) {
  const provider = env.speechProvider;

  if (provider === 'faster_whisper') {
    const { transcribeWithFasterWhisper } =
      await import('./fasterWhisperProvider.js');

    return transcribeWithFasterWhisper(input);
  }

  if (provider === 'mock') {
    const { transcribeWithMock } =
      await import('./mockSpeechProvider.js');

    return transcribeWithMock(input);
  }

  if (provider === 'google') {
    const { transcribeWithGoogle } =
      await import('./googleSpeechProvider.js');

    return transcribeWithGoogle(input);
  }

  throw new AppError(
    `Unsupported speech provider: ${provider}. Use "faster_whisper", "mock", or "google".`,
    500,
  );
}
