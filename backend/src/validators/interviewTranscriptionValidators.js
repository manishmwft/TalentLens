import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const retryTranscriptionSchema = {
  params: z.object({
    interviewId: objectId,
    answerId: objectId,
  }),
  body: z.object({
    force: z.coerce.boolean().optional().default(false),
    wait: z.coerce.boolean().optional().default(false),
  }),
};
