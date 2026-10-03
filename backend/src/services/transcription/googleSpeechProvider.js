import fs from 'fs/promises';
import path from 'path';
import speech from '@google-cloud/speech';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

let client;

function getClient() {
  if (client) return client;

  const options = {};

  if (env.googleCloudCredentialsJson) {
    try {
      options.credentials = JSON.parse(env.googleCloudCredentialsJson);
    } catch {
      throw new AppError(
        'GOOGLE_CLOUD_CREDENTIALS_JSON contains invalid JSON.',
        500,
      );
    }
  }

  if (env.googleCloudProjectId) {
    options.projectId = env.googleCloudProjectId;
  }

  // When no explicit JSON is supplied, the official client uses
  // Application Default Credentials, including GOOGLE_APPLICATION_CREDENTIALS.
  client = new speech.SpeechClient(options);
  return client;
}

function detectEncoding(mimeType = '', filePath = '') {
  const normalized = mimeType.toLowerCase();
  const extension = path.extname(filePath).toLowerCase();

  if (normalized.includes('webm') || extension === '.webm') return 'WEBM_OPUS';
  if (normalized.includes('ogg') || extension === '.ogg') return 'OGG_OPUS';
  if (normalized.includes('wav') || extension === '.wav') return 'LINEAR16';
  if (normalized.includes('mpeg') || extension === '.mp3') return 'MP3';

  throw new AppError(
    `Google Speech-to-Text does not support the uploaded audio format: ${mimeType || extension || 'unknown'}`,
    400,
  );
}

function normalizeLanguage(language = '') {
  const raw = String(language || env.googleSpeechLanguage || 'en-US').trim();
  if (!raw) return 'en-US';
  if (/^[a-z]{2}-[A-Z]{2}$/.test(raw)) return raw;

  const defaults = {
    en: 'en-US',
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    mr: 'mr-IN',
    gu: 'gu-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    bn: 'bn-IN',
  };

  return defaults[raw.toLowerCase()] || raw;
}

function responseToTranscript(response) {
  const alternatives = (response?.results || [])
    .map((result) => result.alternatives?.[0])
    .filter(Boolean);

  const text = alternatives
    .map((alternative) => alternative.transcript || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const confidences = alternatives
    .map((alternative) => Number(alternative.confidence))
    .filter(Number.isFinite);

  const confidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : null;

  return { text, confidence };
}

export async function transcribeWithGoogle({
  filePath,
  mimeType,
  durationSeconds = 0,
  languageCode,
}) {
  const absolutePath = path.resolve(filePath);
  const audioBuffer = await fs.readFile(absolutePath);

  if (!audioBuffer.length) {
    throw new AppError('Audio recording is empty.', 400);
  }

  const request = {
    config: {
      encoding: detectEncoding(mimeType, absolutePath),
      languageCode: normalizeLanguage(languageCode),
      enableAutomaticPunctuation: true,
      model: env.googleSpeechModel,
    },
    audio: {
      content: audioBuffer.toString('base64'),
    },
  };

  const speechClient = getClient();
  let response;

  // Synchronous recognition is intended for short audio. Use long-running
  // recognition for longer candidate responses.
  if (Number(durationSeconds || 0) > 55) {
    const [operation] = await speechClient.longRunningRecognize(request);
    [response] = await operation.promise();
  } else {
    [response] = await speechClient.recognize(request);
  }

  const { text, confidence } = responseToTranscript(response);

  if (!text) {
    throw new AppError(
      'Google processed the recording but did not detect transcribable speech.',
      422,
    );
  }

  return {
    text,
    confidence,
    language: request.config.languageCode,
    provider: 'google',
    model: env.googleSpeechModel,
    responseMetadata: {
      resultCount: response?.results?.length || 0,
    },
  };
}
