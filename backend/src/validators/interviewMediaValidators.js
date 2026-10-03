import { z } from 'zod';
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const interviewAnswerMediaSchema = {
  params: z.object({
    interviewId: objectId,
    answerId: objectId,
    mediaType: z.enum(['audio', 'video']),
  }),
};
