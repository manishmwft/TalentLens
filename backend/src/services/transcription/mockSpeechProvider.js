import path from 'path';
import { env } from '../../config/env.js';

export async function transcribeWithMock({ filePath, languageCode }) {
  const filename = path.basename(filePath || 'audio');
  const text =
    env.mockTranscriptText ||
    `Mock transcript generated for ${filename}. Replace SPEECH_PROVIDER=mock with SPEECH_PROVIDER=google to use Google Speech-to-Text.`;

  return {
    text,
    confidence: 1,
    language: languageCode || env.googleSpeechLanguage || 'en-US',
    provider: 'mock',
    model: 'mock-transcriber',
    responseMetadata: {
      filename,
      mocked: true,
    },
  };
}
