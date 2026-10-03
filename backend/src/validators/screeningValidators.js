import { z } from 'zod';

export const screeningIdSchema = z.object({
  params: z.object({
    screeningId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid screening id'),
  }),
});


export const candidateResumeSchema = z.object({
  params: z.object({
    screeningId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid screening id'),
    candidateId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid candidate id'),
  }),
});

export const screeningExportSchema = z.object({
  body: z.object({
    screeningIds: z
      .array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid screening id'))
      .min(1, 'Select at least one screening')
      .max(200, 'You can export a maximum of 200 screenings at once'),
  }),
});


export const candidateWorkflowSchema = z.object({
  params: z.object({
    screeningId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid screening id'),
    candidateId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid candidate id'),
  }),
  body: z.object({
    workflowStatus: z.enum([
      'new',
      'reviewing',
      'shortlisted',
      'interview',
      'offer',
      'rejected',
      'hired',
    ]),
  }),
});

export const candidateNotesSchema = z.object({
  params: z.object({
    screeningId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid screening id'),
    candidateId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid candidate id'),
  }),
  body: z.object({
    recruiterNotes: z.string().max(5000, 'Notes cannot exceed 5000 characters'),
  }),
});
