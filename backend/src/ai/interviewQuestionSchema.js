import { z } from 'zod';

export const INTERVIEW_CATEGORIES = [
  'technical',
  'behavioral',
  'situational',
  'resume_based',
  'project_based',
  'problem_solving',
  'leadership',
  'culture_fit',
];

export const INTERVIEW_DIFFICULTIES = ['basic', 'intermediate', 'advanced'];

export const generatedQuestionSchema = z.object({
  question: z.string().trim().min(10).max(1000),
  category: z.enum(INTERVIEW_CATEGORIES),
  difficulty: z.enum(INTERVIEW_DIFFICULTIES),
  reason: z.string().trim().min(1).max(1000),
  expectedPoints: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
  followUpQuestions: z.array(z.string().trim().min(1).max(500)).max(4).default([]),
  evaluationGuidance: z.string().trim().min(1).max(1500),
});

export const generatedQuestionSetSchema = z.object({
  title: z.string().trim().min(1).max(200),
  questions: z.array(generatedQuestionSchema).min(1).max(15),
});

export const interviewQuestionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'questions'],
  properties: {
    title: { type: 'string' },
    questions: {
      type: 'array',
      minItems: 1,
      maxItems: 15,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'question',
          'category',
          'difficulty',
          'reason',
          'expectedPoints',
          'followUpQuestions',
          'evaluationGuidance',
        ],
        properties: {
          question: { type: 'string' },
          category: { type: 'string', enum: INTERVIEW_CATEGORIES },
          difficulty: { type: 'string', enum: INTERVIEW_DIFFICULTIES },
          reason: { type: 'string' },
          expectedPoints: { type: 'array', items: { type: 'string' } },
          followUpQuestions: { type: 'array', items: { type: 'string' } },
          evaluationGuidance: { type: 'string' },
        },
      },
    },
  },
};
