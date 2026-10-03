import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { automatedAnswerEvaluationSchema } from '../ai/automatedAnswerEvaluationSchema.js';
import { parseModelJson } from '../utils/jsonResponseParser.js';
import { AppError } from '../utils/AppError.js';

let client;

function getClient() {
  if (!env.geminiApiKey) {
    throw new AppError('GEMINI_API_KEY is missing.', 500);
  }

  if (!client) {
    client = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }

  return client;
}

function limit(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n[Content truncated]`;
}

function cleanList(values, maxItems = 15, maxLength = 500) {
  return (Array.isArray(values) ? values : [])
    .map((value) => limit(value, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function buildPrompt({
  question,
  transcript,
  jobDescription,
  candidateSummary,
}) {
  return [
    'You are an AI interview answer evaluator for an applicant tracking system.',
    'Evaluate only the evidence contained in the transcript.',
    'Do not infer protected traits, personality, honesty, disability, age, gender, ethnicity, religion, or health.',
    'Do not reward accent, speaking speed, or native-language fluency.',
    'Communication clarity means whether the response is understandable, structured, and relevant.',
    'The result is advisory and must be reviewed by authorized hiring staff.',
    '',
    'Return ONLY valid JSON. Do not use Markdown or code fences.',
    'Required JSON shape:',
    JSON.stringify({
      coverageScore: 0,
      technicalCorrectness: 0,
      communicationClarity: 0,
      relevanceScore: 0,
      suggestedScore: 0,
      coveredPoints: [],
      missingPoints: [],
      strengths: [],
      concerns: [],
      feedback: '',
      suggestedFollowUp: '',
    }),
    '',
    'SCORING RULES:',
    '- coverageScore: 0-100 based on expected points addressed.',
    '- technicalCorrectness: 0-100 based on factual and practical correctness.',
    '- communicationClarity: 0-100 based only on understandable structure and clarity.',
    '- relevanceScore: 0-100 based on how directly the answer addresses the question.',
    '- suggestedScore: 0-5, where 0 means no usable answer and 5 means exceptional.',
    '- If the transcript is empty, irrelevant, or too short to assess, score conservatively and explain why.',
    '',
    `JOB DESCRIPTION CONTEXT:\n${limit(jobDescription, 5000) || 'Not provided'}`,
    '',
    `CANDIDATE SCREENING SUMMARY:\n${limit(candidateSummary, 2500) || 'Not provided'}`,
    '',
    `QUESTION:\n${limit(question.question, 1500)}`,
    `CATEGORY: ${limit(question.category, 100)}`,
    `DIFFICULTY: ${limit(question.difficulty, 100)}`,
    `EXPECTED POINTS: ${JSON.stringify(cleanList(question.expectedPoints))}`,
    `EVALUATION GUIDANCE:\n${limit(question.evaluationGuidance, 2000) || 'Not provided'}`,
    '',
    `CANDIDATE TRANSCRIPT:\n${limit(transcript, 30000)}`,
  ].join('\n');
}

function mapProviderError(error) {
  const message = String(error?.message || 'AI answer evaluation failed.');
  const lower = message.toLowerCase();

  if (
    message.includes('429') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    return new AppError(
      'Gemini quota or rate limit was exceeded. The evaluation can be retried later.',
      503,
    );
  }

  if (
    message.includes('401') ||
    message.includes('403') ||
    lower.includes('api key')
  ) {
    return new AppError(
      'Gemini authentication failed. Check GEMINI_API_KEY.',
      500,
    );
  }

  return new AppError(message, 502);
}

async function requestEvaluation(input) {
  const response = await getClient().models.generateContent({
    model: env.geminiModel,
    contents: buildPrompt(input),
    config: {
      temperature: 0.1,
      maxOutputTokens: 3000,
      responseMimeType: 'application/json',
    },
  });

  const parsed = parseModelJson(
    response.text,
    'Gemini returned invalid automated answer-evaluation JSON.',
  );

  return {
    result: automatedAnswerEvaluationSchema.parse(parsed),
    provider: 'gemini',
    model: response.modelVersion || env.geminiModel,
  };
}

export async function evaluateAutomatedInterviewAnswer(input) {
  if (!String(input.transcript || '').trim()) {
    throw new AppError(
      'A completed transcript is required before AI evaluation.',
      409,
    );
  }

  try {
    return await requestEvaluation(input);
  } catch (firstError) {
    // Retry once for malformed or prematurely truncated model output.
    const retryable =
      String(firstError?.message || '').toLowerCase().includes('json') ||
      firstError?.name === 'ZodError';

    if (!retryable) {
      throw mapProviderError(firstError);
    }

    try {
      return await requestEvaluation(input);
    } catch (secondError) {
      throw mapProviderError(secondError);
    }
  }
}
