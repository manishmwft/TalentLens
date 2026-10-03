import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import {
  generatedQuestionSetSchema,
  INTERVIEW_CATEGORIES,
  INTERVIEW_DIFFICULTIES,
} from '../ai/interviewQuestionSchema.js';
import { parseModelJson } from '../utils/jsonResponseParser.js';

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

function truncate(value, maximumLength) {
  const text = String(value || '').trim();

  if (text.length <= maximumLength) {
    return text;
  }

  return `${text.slice(0, maximumLength)}\n[Content truncated]`;
}

function uniqueStrings(value, maximumItems) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, maximumItems);
}

function normalizeCategory(value, fallback = 'technical') {
  return INTERVIEW_CATEGORIES.includes(value)
    ? value
    : fallback;
}

function normalizeDifficulty(value, fallback = 'intermediate') {
  return INTERVIEW_DIFFICULTIES.includes(value)
    ? value
    : fallback;
}

function normalizeQuestion(rawQuestion, requestedDifficulty) {
  const questionText = String(
    rawQuestion?.question || rawQuestion?.q || '',
  ).trim();

  const reason = String(
    rawQuestion?.reason || rawQuestion?.r || '',
  ).trim();

  const evaluationGuidance = String(
    rawQuestion?.evaluationGuidance ||
      rawQuestion?.evaluation ||
      rawQuestion?.guide ||
      rawQuestion?.g ||
      '',
  ).trim();

  return {
    question: questionText,
    category: normalizeCategory(
      rawQuestion?.category || rawQuestion?.c,
    ),
    difficulty: normalizeDifficulty(
      rawQuestion?.difficulty || rawQuestion?.d,
      requestedDifficulty,
    ),
    reason:
      reason ||
      'This question checks evidence relevant to the candidate and role.',
    expectedPoints: uniqueStrings(
      rawQuestion?.expectedPoints ||
        rawQuestion?.answerPoints ||
        rawQuestion?.points ||
        rawQuestion?.p,
      8,
    ),
    followUpQuestions: uniqueStrings(
      rawQuestion?.followUpQuestions ||
        rawQuestion?.followUps ||
        rawQuestion?.followup ||
        rawQuestion?.f,
      4,
    ),
    evaluationGuidance:
      evaluationGuidance ||
      'Look for a clear, accurate answer supported by practical examples.',
  };
}

function normalizeQuestionSet(rawValue, input) {
  const sourceQuestions = Array.isArray(rawValue?.questions)
    ? rawValue.questions
    : Array.isArray(rawValue?.items)
      ? rawValue.items
      : [];

  const questions = sourceQuestions
    .map((question) =>
      normalizeQuestion(question, input.difficulty),
    )
    .filter((question) => question.question.length >= 10)
    .slice(0, input.count);

  return {
    title:
      String(rawValue?.title || '').trim() ||
      `${input.difficulty} interview guide`,
    questions,
  };
}

function buildCandidateContext(candidate) {
  const analysis = candidate.analysis || {};

  return {
    candidateName: analysis.candidateName || '',
    currentRole: analysis.currentRole || '',
    totalExperienceYears: analysis.totalExperienceYears || 0,
    matchedSkills: uniqueStrings(analysis.matchedSkills, 20),
    missingSkills: uniqueStrings(analysis.missingSkills, 15),
    strengths: uniqueStrings(analysis.strengths, 8),
    concerns: uniqueStrings(analysis.concerns, 8),
    education: uniqueStrings(analysis.education, 5),
    summary: truncate(analysis.summary, 1500),
  };
}

function buildPrompt({
  interview,
  candidate,
  screening,
  category,
  difficulty,
  count,
  retry = false,
}) {
  const requestedCategory =
    category === 'mixed'
      ? 'a balanced mix of the most relevant categories'
      : category.replaceAll('_', ' ');

  const outputExample = {
    title: 'Candidate interview guide',
    questions: [
      {
        question: 'Ask one concise interview question here.',
        category: 'technical',
        difficulty: 'intermediate',
        reason: 'Explain briefly why this question is relevant.',
        expectedPoints: ['Expected point one', 'Expected point two'],
        followUpQuestions: ['Optional follow-up question'],
        evaluationGuidance: 'Explain what a strong answer should demonstrate.',
      },
    ],
  };

  return [
    'You are a senior interviewer creating an evidence-based interview guide.',
    `Create exactly ${count} distinct questions at ${difficulty} difficulty using ${requestedCategory}.`,
    'Use only the supplied job and candidate evidence. Do not invent experience or qualifications.',
    'Questions must be concise, practical, non-discriminatory, and suitable for a live human-led interview.',
    'Include a short relevance reason, 2 to 5 expected answer points, up to 2 follow-up questions, and concise evaluation guidance.',
    'Keep every string brief so the JSON response is compact.',
    'Return only one valid JSON object. Do not return markdown, code fences, commentary, or text outside JSON.',
    'Use exactly these category values: technical, behavioral, situational, resume_based, project_based, problem_solving, leadership, culture_fit.',
    'Use exactly these difficulty values: basic, intermediate, advanced.',
    retry
      ? 'The previous response was invalid. Pay special attention to JSON syntax, double quotes, and the exact field names.'
      : '',
    '',
    'REQUIRED JSON SHAPE:',
    JSON.stringify(outputExample),
    '',
    'INTERVIEW:',
    JSON.stringify({
      mode: interview.mode,
      durationMinutes: interview.durationMinutes,
    }),
    '',
    'JOB DESCRIPTION:',
    truncate(screening.jobDescription, 9000),
    '',
    'CANDIDATE ANALYSIS:',
    JSON.stringify(buildCandidateContext(candidate)),
    '',
    'SELECTED RESUME EVIDENCE:',
    truncate(candidate.extractedText, 10000),
  ]
    .filter(Boolean)
    .join('\n');
}

function mapError(error) {
  const message = String(
    error?.message || 'Interview question generation failed.',
  );
  const lower = message.toLowerCase();

  if (
    message.includes('429') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('resource_exhausted')
  ) {
    return new Error(
      'Gemini quota or rate limit was exceeded. Wait briefly and try again.',
    );
  }

  if (
    message.includes('401') ||
    message.includes('403') ||
    lower.includes('api key')
  ) {
    return new Error(
      'Gemini authentication failed. Check GEMINI_API_KEY.',
    );
  }

  if (
    lower.includes('too many states') ||
    lower.includes('specified schema produces a constraint')
  ) {
    return new Error(
      'Gemini rejected the structured response format. The JSON fallback generator could not complete the request.',
    );
  }

  return new Error(message);
}

async function requestQuestionSet(ai, input, retry = false) {
  const response = await ai.models.generateContent({
    model: env.geminiModel,
    contents: buildPrompt({ ...input, retry }),
    config: {
      temperature: retry ? 0.05 : 0.2,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  });

  const rawText = String(response?.text || '').trim();

  if (!rawText) {
    throw new Error('Gemini returned an empty interview-question response.');
  }

  const parsed = parseModelJson(
    rawText,
    'Gemini returned invalid interview-question JSON.',
  );
  const normalized = normalizeQuestionSet(parsed, input);
  const validated = generatedQuestionSetSchema.safeParse(normalized);

  if (!validated.success) {
    const firstIssue = validated.error.issues[0];
    throw new Error(
      firstIssue?.message
        ? `Gemini question validation failed: ${firstIssue.message}`
        : 'Gemini question validation failed.',
    );
  }

  if (validated.data.questions.length !== input.count) {
    throw new Error(
      `Gemini returned ${validated.data.questions.length} valid questions instead of ${input.count}.`,
    );
  }

  return {
    data: validated.data,
    provider: 'gemini',
    model: response.modelVersion || env.geminiModel,
    responseId: response.responseId || '',
  };
}

export async function generateInterviewQuestions(input) {
  const ai = getClient();

  try {
    let generated;

    try {
      generated = await requestQuestionSet(ai, input, false);
    } catch (firstError) {
      const retryable = [
        'invalid interview-question json',
        'question validation failed',
        'valid questions instead of',
        'empty interview-question response',
      ].some((text) =>
        String(firstError?.message || '')
          .toLowerCase()
          .includes(text),
      );

      if (!retryable) {
        throw firstError;
      }

      console.warn(
        'Retrying Gemini interview-question generation:',
        firstError.message,
      );

      generated = await requestQuestionSet(ai, input, true);
    }

    return {
      ...generated.data,
      provider: generated.provider,
      model: generated.model,
      responseId: generated.responseId,
    };
  } catch (error) {
    console.error('Interview question generation error:', error);
    throw mapError(error);
  }
}
