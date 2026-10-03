import { z } from 'zod';

const boundedText = (max) => z.string().trim().max(max);

export const automatedAnswerEvaluationSchema = z.object({
  coverageScore: z.coerce.number().min(0).max(100),
  technicalCorrectness: z.coerce.number().min(0).max(100),
  communicationClarity: z.coerce.number().min(0).max(100),
  relevanceScore: z.coerce.number().min(0).max(100),
  suggestedScore: z.coerce.number().min(0).max(5),

  coveredPoints: z
    .array(boundedText(500).min(1))
    .max(12)
    .default([]),

  missingPoints: z
    .array(boundedText(500).min(1))
    .max(12)
    .default([]),

  strengths: z
    .array(boundedText(500).min(1))
    .max(10)
    .default([]),

  concerns: z
    .array(boundedText(500).min(1))
    .max(10)
    .default([]),

  feedback: boundedText(3000).min(1),
  suggestedFollowUp: boundedText(1000).default(''),
});
