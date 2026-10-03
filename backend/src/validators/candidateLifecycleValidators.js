import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

const candidateParams = z.object({
  screeningId: objectId,
  candidateId: objectId,
});

export const candidateTimelineSchema = z.object({
  params: candidateParams,
});

export const hiringDecisionSchema = z.object({
  params: candidateParams,
  body: z.object({
    decision: z.enum(['move_forward', 'hold', 'reject', 'offer', 'hired']),
    reason: z.string().trim().min(3, 'Decision reason must contain at least 3 characters').max(2000),
    notes: z.string().trim().max(5000).optional().default(''),
    interviewId: objectId.optional().nullable(),
  }),
});
