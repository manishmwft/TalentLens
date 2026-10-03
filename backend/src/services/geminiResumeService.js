import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import {
  resumeAnalysisJsonSchema,
  resumeAnalysisSchema,
} from '../ai/resumeAnalysisSchema.js';

let client;

function getClient() {
  if (!env.geminiApiKey) {
    throw new Error(
      'GEMINI_API_KEY is missing. Add it to backend/.env and restart the backend.',
    );
  }

  if (!client) {
    client = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }

  return client;
}

function trimInput(text, maxCharacters) {
  const value = String(text || '').trim();

  return value.length > maxCharacters
    ? `${value.slice(0, maxCharacters)}\n\n[Content truncated]`
    : value;
}

function buildPrompt({ resumeText, jobDescription, retry = false }) {
  return [
    'You are a careful and evidence-based recruitment screening assistant.',
    'Compare only the supplied resume against the supplied job description.',
    'Return exactly one valid JSON object matching the supplied response schema.',
    'Do not include markdown, code fences, comments, headings, or text before or after the JSON object.',
    retry
      ? 'This is a retry because the previous response was invalid. Keep every array concise and ensure the JSON is complete.'
      : '',
    'Do not invent qualifications, employment, contact information, skills, education, or experience.',
    'Extract the candidate name, email address, phone number, current role, education, skills, and experience directly from the supplied resume.',
    'For email and phone, carefully inspect the resume header and contact-information section.',
    'Preserve the email address exactly as written in the resume.',
    'Preserve the phone number in a readable format, including its country code when available.',
    'Do not replace visible contact information with an empty string.',
    'Use empty strings or empty arrays only when information is genuinely unavailable in the resume.',
    'Treat a skill as matched only when the resume provides evidence for it.',
    'Missing skills must include important job requirements not evidenced in the resume.',
    'Estimate total experience from employment dates when possible.',
    'Ignore protected characteristics and demographic information.',
    'Calculate matchScore from 0 to 100 using relevant skills, experience, education, responsibilities, and evidence.',
    'Use strong_match for scores 85-100, good_match for 70-84, partial_match for 50-69, and not_recommended for 0-49.',
    'Limit skills to 30 items, matchedSkills and missingSkills to 20 items each, strengths and concerns to 6 items each, and education to 5 items.',
    'Keep summary below 700 characters.',
    '',
    'JOB DESCRIPTION:',
    trimInput(jobDescription, 24000),
    '',
    'CANDIDATE RESUME:',
    trimInput(resumeText, 50000),
  ]
    .filter(Boolean)
    .join('\n');
}

function stripCodeFences(value) {
  return String(value || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractJsonObject(value) {
  const cleaned = stripCodeFences(value)
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('Gemini returned invalid JSON.');
    }

    const jsonOnly = cleaned.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(jsonOnly);
    } catch {
      // Occasionally a model adds a trailing comma before a closing bracket.
      const withoutTrailingCommas = jsonOnly.replace(/,\s*([}\]])/g, '$1');

      try {
        return JSON.parse(withoutTrailingCommas);
      } catch {
        throw new Error('Gemini returned invalid JSON.');
      }
    }
  }
}

function getFinishReason(response) {
  return (
    response?.candidates?.[0]?.finishReason ||
    response?.candidates?.[0]?.finish_reason ||
    ''
  );
}

async function requestAnalysis(ai, input, retry = false) {
  const response = await ai.models.generateContent({
    model: env.geminiModel,
    contents: buildPrompt({ ...input, retry }),
    config: {
      temperature: 0,
      maxOutputTokens: retry ? 8192 : 6144,
      responseMimeType: 'application/json',
      responseJsonSchema: resumeAnalysisJsonSchema,
    },
  });

  const outputText = String(response.text || '').trim();

  if (!outputText) {
    throw new Error('Gemini returned an empty analysis.');
  }

  const finishReason = String(getFinishReason(response)).toUpperCase();

  if (finishReason.includes('MAX_TOKEN')) {
    throw new Error('Gemini response was cut off before the JSON was completed.');
  }

  return {
    response,
    parsed: extractJsonObject(outputText),
    outputText,
  };
}

function mapGeminiError(error) {
  const rawMessage = String(error?.message || 'Gemini analysis failed.');
  const lowerMessage = rawMessage.toLowerCase();

  if (
    rawMessage.includes('429') ||
    lowerMessage.includes('resource_exhausted') ||
    lowerMessage.includes('quota') ||
    lowerMessage.includes('rate limit')
  ) {
    return new Error(
      'Gemini API rate limit or quota was exceeded. Wait briefly and retry, or check your Google AI Studio project limits.',
    );
  }

  if (
    rawMessage.includes('401') ||
    rawMessage.includes('403') ||
    lowerMessage.includes('api key') ||
    lowerMessage.includes('permission denied')
  ) {
    return new Error(
      'Gemini API authentication failed. Check GEMINI_API_KEY in backend/.env.',
    );
  }

  if (
    lowerMessage.includes('model') &&
    (lowerMessage.includes('not found') || lowerMessage.includes('unsupported'))
  ) {
    return new Error(
      'The configured Gemini model is unavailable. Check GEMINI_MODEL in backend/.env.',
    );
  }

  return new Error(rawMessage);
}

export async function analyzeResume({ resumeText, jobDescription }) {
  if (env.aiProvider !== 'gemini') {
    throw new Error(
      `Unsupported AI_PROVIDER "${env.aiProvider}". Set AI_PROVIDER=gemini in backend/.env.`,
    );
  }

  if (!String(resumeText || '').trim()) {
    throw new Error('Resume text is required for AI analysis.');
  }

  if (!String(jobDescription || '').trim()) {
    throw new Error('Job description is required for AI analysis.');
  }

  const ai = getClient();
  const input = { resumeText, jobDescription };

  try {
    let result;

    try {
      result = await requestAnalysis(ai, input, false);
    } catch (firstError) {
      const retryable =
        firstError.message === 'Gemini returned invalid JSON.' ||
        firstError.message.includes('cut off');

      if (!retryable) {
        throw firstError;
      }

      console.warn(
        `Gemini returned malformed or incomplete JSON. Retrying once: ${firstError.message}`,
      );

      result = await requestAnalysis(ai, input, true);
    }

    const validatedAnalysis = resumeAnalysisSchema.parse(result.parsed);

    return {
      analysis: validatedAnalysis,
      model: result.response.modelVersion || env.geminiModel,
      provider: 'gemini',
      responseId: result.response.responseId || '',
    };
  } catch (error) {
    console.error('Gemini analysis error:', error);
    throw mapGeminiError(error);
  }
}
