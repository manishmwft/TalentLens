import { z } from 'zod';
import { INTERVIEW_CATEGORIES, INTERVIEW_DIFFICULTIES } from '../ai/interviewQuestionSchema.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const rating = z.coerce.number().min(0).max(5);

export const interviewAssignmentSchema = {
  params: z.object({ screeningId: objectId, candidateId: objectId }),
  body: z.object({
    interviewerId: objectId,
    scheduledAt: z.coerce.date(),
    durationMinutes: z.coerce.number().int().min(15).max(240).default(45),
    mode: z.enum(['video', 'phone', 'in_person']).default('video'),
    meetingLink: z.string().trim().max(500).optional().default(''),
    location: z.string().trim().max(500).optional().default(''),
    instructions: z.string().trim().max(2000).optional().default(''),
  }),
};

export const interviewIdSchema = { params: z.object({ interviewId: objectId }) };
export const interviewStatusSchema = {
  params: z.object({ interviewId: objectId }),
  body: z.object({ status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']) }),
};

export const questionGenerationSchema = {
  params: z.object({ interviewId: objectId }),
  body: z.object({
    category: z.enum(['mixed', ...INTERVIEW_CATEGORIES]).default('mixed'),
    difficulty: z.enum(INTERVIEW_DIFFICULTIES).default('intermediate'),
    count: z.coerce.number().int().min(3).max(15).default(8),
  }),
};

export const customQuestionSchema = {
  params: z.object({ interviewId: objectId }),
  body: z.object({
    question: z.string().trim().min(10).max(1000),
    category: z.enum(INTERVIEW_CATEGORIES).default('technical'),
    difficulty: z.enum(INTERVIEW_DIFFICULTIES).default('intermediate'),
    reason: z.string().trim().max(1000).optional().default('Custom recruiter question'),
    expectedPoints: z.array(z.string().trim().min(1).max(300)).max(8).optional().default([]),
    followUpQuestions: z.array(z.string().trim().min(1).max(500)).max(4).optional().default([]),
    evaluationGuidance: z.string().trim().max(1500).optional().default(''),
  }),
};

export const questionUpdateSchema = {
  params: z.object({ interviewId: objectId, questionId: objectId }),
  body: z.object({
    question: z.string().trim().min(10).max(1000).optional(),
    category: z.enum(INTERVIEW_CATEGORIES).optional(),
    difficulty: z.enum(INTERVIEW_DIFFICULTIES).optional(),
    reason: z.string().trim().max(1000).optional(),
    expectedPoints: z.array(z.string().trim().min(1).max(300)).max(8).optional(),
    followUpQuestions: z.array(z.string().trim().min(1).max(500)).max(4).optional(),
    evaluationGuidance: z.string().trim().max(1500).optional(),
    isAsked: z.boolean().optional(),
    interviewerNotes: z.string().max(5000).optional(),
  }).refine((value) => Object.keys(value).length > 0, 'At least one field is required'),
};

export const questionResponseSchema = {
  params: z.object({ interviewId: objectId, questionId: objectId }),
  body: z.object({
    candidateAnswer: z.string().max(12000).default(''),
    interviewerScore: rating.default(0),
    technicalAccuracy: rating.default(0),
    communicationQuality: rating.default(0),
    confidenceLevel: z.enum(['', 'low', 'medium', 'high']).default(''),
    interviewerComments: z.string().max(5000).default(''),
    followUpOutcome: z.string().max(3000).default(''),
  }),
};

export const questionEvaluationSchema = {
  params: z.object({ interviewId: objectId, questionId: objectId }),
  body: z.object({ candidateAnswer: z.string().trim().min(10).max(12000).optional() }).default({}),
};

export const finalFeedbackSchema = {
  params: z.object({ interviewId: objectId }),
  body: z.object({
    technicalScore: rating,
    communicationScore: rating,
    problemSolvingScore: rating,
    roleFitScore: rating,
    recommendation: z.enum(['strong_hire', 'hire', 'hold', 'no_hire']),
    strengths: z.string().max(5000).default(''),
    concerns: z.string().max(5000).default(''),
    finalComments: z.string().max(10000).default(''),
  }),
};

export const questionIdSchema = { params: z.object({ interviewId: objectId, questionId: objectId }) };
export const reorderQuestionsSchema = {
  params: z.object({ interviewId: objectId }),
  body: z.object({ questionIds: z.array(objectId).min(1).max(30) }),
};
