import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid application id');

export const listWebsiteApplicationsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    search: z.string().trim().max(200).optional().default(''),
    status: z.enum([
      'all',
      'received',
      'jd_mapping_required',
      'ready_for_review',
      'selected_for_screening',
      'screening',
      'analyzed',
      'archived',
      'failed',
    ]).optional().default('all'),
    mappingStatus: z.enum(['all', 'mapped', 'mapping_required']).optional().default('all'),
    externalJobId: z.string().trim().max(120).optional().default(''),
    fromDate: z.string().trim().optional().default(''),
    toDate: z.string().trim().optional().default(''),
    scoreBand: z.enum(['all', '80_100', '60_79', '40_59', '0_39']).optional().default('all'),
    jobDescriptionId: z.string().trim().optional().default('').refine(
      (value) => !value || /^[a-f\d]{24}$/i.test(value),
      'Invalid job description id',
    ),
  }),
};

export const websiteApplicationIdSchema = {
  params: z.object({ applicationId: objectId }),
};

export const screenSelectedWebsiteApplicationsSchema = {
  body: z.object({
    applicationIds: z
      .array(objectId)
      .min(1, 'Select at least one website application')
      .max(100, 'A maximum of 100 applications can be screened at once')
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Duplicate application IDs are not allowed',
      }),
  }),
};
