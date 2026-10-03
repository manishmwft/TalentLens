import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

function normalizeLanguage(language = '') {
  const value = String(language || env.fasterWhisperLanguage || '').trim();

  if (!value || value.toLowerCase() === 'auto') {
    return '';
  }

  return value.split('-')[0].toLowerCase();
}

async function parseResponse(response) {
  const raw = await response.text();

  let data;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new AppError(
      `Local transcription service returned invalid JSON (HTTP ${response.status}).`,
      502,
    );
  }

  if (!response.ok || data.success === false) {
    throw new AppError(
      data.message ||
        data.detail ||
        `Local transcription failed with HTTP ${response.status}.`,
      response.status >= 400 && response.status < 500
        ? response.status
        : 502,
    );
  }

  return data;
}

export async function checkFasterWhisperHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.min(env.fasterWhisperTimeoutMs, 15_000),
  );

  try {
    const response = await fetch(
      `${env.fasterWhisperServiceUrl}/health`,
      {
        headers: env.fasterWhisperToken
          ? {
              'X-Transcription-Token':
                env.fasterWhisperToken,
            }
          : {},
        signal: controller.signal,
      },
    );

    return parseResponse(response);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new AppError(
        'The local faster-whisper service health check timed out.',
        503,
      );
    }

    throw new AppError(
      `Unable to connect to the local faster-whisper service at ${env.fasterWhisperServiceUrl}. Start the Python service before processing answers. ${error.message}`,
      503,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function transcribeWithFasterWhisper({
  filePath,
  mimeType,
  languageCode,
}) {
  const absolutePath = path.resolve(filePath);
  const audioBuffer = await fs.readFile(absolutePath);

  if (!audioBuffer.length) {
    throw new AppError('Audio recording is empty.', 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    env.fasterWhisperTimeoutMs,
  );

  try {
    const form = new FormData();

    form.append(
      'audio',
      new Blob([audioBuffer], {
        type: mimeType || 'audio/webm',
      }),
      path.basename(absolutePath),
    );

    form.append(
      'language',
      normalizeLanguage(languageCode),
    );

    form.append(
      'task',
      env.fasterWhisperTask,
    );

    const response = await fetch(
      `${env.fasterWhisperServiceUrl}/transcribe`,
      {
        method: 'POST',
        headers: env.fasterWhisperToken
          ? {
              'X-Transcription-Token':
                env.fasterWhisperToken,
            }
          : {},
        body: form,
        signal: controller.signal,
      },
    );

    const data = await parseResponse(response);

    const text = String(data.text || '').trim();

    if (!text) {
      throw new AppError(
        'The local Whisper service processed the recording but did not detect speech.',
        422,
      );
    }

    return {
      text,
      confidence:
        Number.isFinite(Number(data.confidence))
          ? Number(data.confidence)
          : null,
      language:
        data.language ||
        normalizeLanguage(languageCode) ||
        '',
      provider: 'faster_whisper',
      model:
        data.model ||
        env.fasterWhisperModel,
      responseMetadata: {
        durationSeconds:
          Number(data.durationSeconds || 0),
        languageProbability:
          data.languageProbability ?? null,
        segmentCount:
          Number(data.segmentCount || 0),
        device: data.device || '',
        computeType: data.computeType || '',
      },
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new AppError(
        `Local transcription exceeded the ${Math.round(
          env.fasterWhisperTimeoutMs / 1000,
        )}-second timeout.`,
        504,
      );
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      `Local faster-whisper transcription failed: ${error.message}`,
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}
