import { z } from 'zod';

export const answerEvaluationSchema = z.object({
  coverageScore: z.coerce.number().min(0).max(100),
  technicalCorrectness: z.coerce.number().min(0).max(100),
  communicationClarity: z.coerce.number().min(0).max(100),
  suggestedScore: z.coerce.number().min(0).max(5),
  coveredPoints: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  missingPoints: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  feedback: z.string().trim().min(1).max(2000),
  suggestedFollowUp: z.string().trim().max(1000).default(''),
});
