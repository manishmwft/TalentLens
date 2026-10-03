import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const automatedInterviewDraftSchema = {
  params: z.object({ screeningId: objectId, candidateId: objectId }),
};

export const automatedInterviewSendSchema = {
  params: z.object({ interviewId: objectId }),
  body: z.object({
    expiresAt: z.coerce.date().refine(
      (value) => value.getTime() > Date.now() + 15 * 60 * 1000,
      'Expiry must be at least 15 minutes in the future',
    ),
    availableFrom: z.coerce.date().optional(),
    durationMinutes: z.coerce.number().int().min(15).max(240).default(45),
    language: z.string().trim().min(2).max(20).default('en'),
    preparationTimeSeconds: z.coerce.number().int().min(0).max(600).default(30),
    questionTimeSeconds: z.coerce.number().int().min(30).max(3600).default(180),
    maxRecordingSeconds: z.coerce.number().int().min(30).max(3600).default(180),
    instructions: z.string().trim().max(2000).optional().default(''),
  }),
};

// Backward-compatible endpoint used by older frontend builds.
export const automatedInterviewInvitationSchema = {
  params: z.object({ screeningId: objectId, candidateId: objectId }),
  body: automatedInterviewSendSchema.body,
};

export const notificationIdSchema = {
  params: z.object({ notificationId: objectId }),
};
