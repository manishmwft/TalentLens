import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const candidateInterviewSessionSchema = { params: z.object({ interviewId: objectId }) };

export const candidateAnswerSubmissionSchema = {
  params: z.object({ interviewId: objectId, questionId: objectId }),
  body: z.object({
    submissionId: z.string().trim().min(12).max(160),
    audioDurationSeconds: z.coerce.number().min(0).max(7200).default(0),
    videoDurationSeconds: z.coerce.number().min(0).max(7200).default(0),
    elapsedSeconds: z.coerce.number().min(0).max(7200).default(0),
    retryCount: z.coerce.number().int().min(0).max(10).default(0),
    expired: z.union([z.boolean(), z.enum(['true', 'false'])]).transform((value) => value === true || value === 'true').default(false),
  }),
};

export const candidateIntegrityEventSchema = {
  params: z.object({ interviewId: objectId }),
  body: z.object({
    type: z.enum(['tab_hidden','window_blur','window_focus','inactivity','camera_disabled','microphone_disabled','network_disconnected','network_reconnected']),
    metadata: z.record(z.unknown()).optional().default({}),
  }),
};
