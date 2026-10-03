import { z } from 'zod';
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const recommendations = ['strong_hire', 'hire', 'hold', 'no_hire'];

export const automatedInterviewResultParamsSchema = {
  params: z.object({ interviewId: objectId }),
  body: z.object({ force: z.coerce.boolean().optional().default(false) }),
};

export const automatedInterviewReviewSchema = {
  params: z.object({ interviewId: objectId }),
  body: z.object({
    notes: z.string().trim().max(5000).optional().default(''),
    adjustedOverallScore: z
      .union([z.coerce.number().min(0).max(100), z.null()])
      .optional().default(null),
    adjustedRecommendation: z
      .enum(recommendations).optional().or(z.literal('')).default(''),
  }),
};
