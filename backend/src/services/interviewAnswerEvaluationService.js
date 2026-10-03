import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { answerEvaluationSchema } from '../ai/interviewEvaluationSchema.js';
import { parseModelJson } from '../utils/jsonResponseParser.js';

let client;

function getClient() {
  if (!env.geminiApiKey) throw new Error('GEMINI_API_KEY is missing.');
  if (!client) client = new GoogleGenAI({ apiKey: env.geminiApiKey });
  return client;
}

function trim(value, max) {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max)}\n[Content truncated]` : text;
}

function buildPrompt({ question, candidateAnswer }) {
  return [
    'You are an interview evaluation assistant. Evaluate the candidate answer only against the supplied question, expected points, and guidance.',
    'Do not infer protected traits or invent evidence. The human interviewer remains the final decision-maker.',
    'Return only valid JSON with these fields:',
    '{"coverageScore":0,"technicalCorrectness":0,"communicationClarity":0,"suggestedScore":0,"coveredPoints":[],"missingPoints":[],"feedback":"","suggestedFollowUp":""}',
    'coverageScore, technicalCorrectness, and communicationClarity must be 0-100. suggestedScore must be 0-5.',
    '',
    `QUESTION: ${trim(question.question, 1500)}`,
    `CATEGORY: ${question.category}`,
    `DIFFICULTY: ${question.difficulty}`,
    `EXPECTED POINTS: ${JSON.stringify(question.expectedPoints || [])}`,
    `EVALUATION GUIDANCE: ${trim(question.evaluationGuidance, 2000)}`,
    '',
    `CANDIDATE ANSWER: ${trim(candidateAnswer, 12000)}`,
  ].join('\n');
}

function mapError(error) {
  const message = String(error?.message || 'AI answer evaluation failed.');
  const lower = message.toLowerCase();
  if (message.includes('429') || lower.includes('quota') || lower.includes('rate limit')) {
    return new Error('Gemini quota or rate limit was exceeded. Wait briefly and try again.');
  }
  if (message.includes('401') || message.includes('403') || lower.includes('api key')) {
    return new Error('Gemini authentication failed. Check GEMINI_API_KEY.');
  }
  return new Error(message);
}

export async function evaluateInterviewAnswer({ question, candidateAnswer }) {
  if (!String(candidateAnswer || '').trim()) throw new Error('Candidate answer is required for AI evaluation.');

  try {
    const response = await getClient().models.generateContent({
      model: env.geminiModel,
      contents: buildPrompt({ question, candidateAnswer }),
      config: {
        temperature: 0.1,
        maxOutputTokens: 2500,
        responseMimeType: 'application/json',
      },
    });

    const parsed = parseModelJson(response.text, 'Gemini returned invalid answer-evaluation JSON.');
    const evaluation = answerEvaluationSchema.parse(parsed);

    return {
      ...evaluation,
      provider: 'gemini',
      model: response.modelVersion || env.geminiModel,
      evaluatedAt: new Date(),
    };
  } catch (error) {
    console.error('Interview answer evaluation error:', error);
    throw mapError(error);
  }
}
