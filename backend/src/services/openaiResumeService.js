import OpenAI from 'openai';
import { env } from '../config/env.js';
import {
  resumeAnalysisJsonSchema,
  resumeAnalysisSchema,
} from '../ai/resumeAnalysisSchema.js';

let client;

function getClient() {
  if (!env.openAiApiKey) {
    throw new Error(
      'OPENAI_API_KEY is missing. Add it to backend/.env and restart the backend.',
    );
  }

  if (!client) {
    client = new OpenAI({ apiKey: env.openAiApiKey });
  }

  return client;
}

function trimInput(text, maxCharacters) {
  const value = String(text || '').trim();
  return value.length > maxCharacters
    ? `${value.slice(0, maxCharacters)}\n\n[Content truncated]`
    : value;
}

export async function analyzeResume({ resumeText, jobDescription }) {
  const openai = getClient();

  const response = await openai.responses.create({
    model: env.openAiModel,
    instructions: [
      'You are a careful recruitment screening assistant.',
      'Compare only the supplied resume against the supplied job description.',
      'Do not invent qualifications, employment, contact information, skills, or experience.',
      'Use empty strings or empty arrays when information is not present.',
      'Calculate matchScore from 0 to 100 using role requirements, relevant experience, skills, education, and evidence in the resume.',
      'Missing skills must contain important job requirements not evidenced in the resume.',
      'Strengths and concerns must be concise and evidence-based.',
      'Use strong_match for 85-100, good_match for 70-84, partial_match for 50-69, and not_recommended for 0-49.',
    ].join(' '),
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `JOB DESCRIPTION:\n${trimInput(jobDescription, 24000)}\n\nRESUME:\n${trimInput(resumeText, 50000)}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'resume_analysis',
        strict: true,
        schema: resumeAnalysisJsonSchema,
      },
    },
  });

  if (!response.output_text) {
    throw new Error('The AI service returned an empty analysis.');
  }

  let parsed;

  try {
    parsed = JSON.parse(response.output_text);
  } catch {
    throw new Error('The AI service returned invalid JSON.');
  }

  return {
    analysis: resumeAnalysisSchema.parse(parsed),
    model: env.openAiModel,
    responseId: response.id || '',
  };
}
