import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid job description id');
const optionalText = (max) => z.string().trim().max(max).optional().default('');

const externalMappingFields = {
  externalSource: z.enum(['', 'wordpress']).optional().default(''),
  externalJobId: z.string().trim().max(120).optional().default(''),
  externalJobTitle: z.string().trim().max(160).optional().default(''),
  externalJobUrl: z.string().trim().url().max(1000).optional().or(z.literal('')).default(''),
  acceptWebsiteApplications: z.boolean().optional().default(false),
};

const jobDescriptionBody = z.object({
  title: z.string().trim().min(2).max(160),
  department: optionalText(120),
  location: optionalText(160),
  employmentType: optionalText(80),
  experienceLevel: optionalText(100),
  description: z.string().trim().min(30).max(30000),
  status: z.enum(['active', 'draft', 'archived']).optional().default('active'),
  ...externalMappingFields,
}).superRefine((value, ctx) => {
  if (value.acceptWebsiteApplications && value.externalSource !== 'wordpress') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['externalSource'],
      message: 'WordPress must be selected as the external source when website applications are enabled',
    });
  }

  if (value.acceptWebsiteApplications && !value.externalJobId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['externalJobId'],
      message: 'External Job ID is required when website applications are enabled',
    });
  }
});

export const createJobDescriptionSchema = z.object({
  body: jobDescriptionBody,
});

export const updateJobDescriptionSchema = z.object({
  params: z.object({ jobDescriptionId: objectId }),
  body: z.object({
    title: z.string().trim().min(2).max(160).optional(),
    department: z.string().trim().max(120).optional(),
    location: z.string().trim().max(160).optional(),
    employmentType: z.string().trim().max(80).optional(),
    experienceLevel: z.string().trim().max(100).optional(),
    description: z.string().trim().min(30).max(30000).optional(),
    status: z.enum(['active', 'draft', 'archived']).optional(),
    externalSource: z.enum(['', 'wordpress']).optional(),
    externalJobId: z.string().trim().max(120).optional(),
    externalJobTitle: z.string().trim().max(160).optional(),
    externalJobUrl: z.string().trim().url().max(1000).optional().or(z.literal('')),
    acceptWebsiteApplications: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  }),
});

export const jobDescriptionIdSchema = z.object({
  params: z.object({ jobDescriptionId: objectId }),
});

export const listJobDescriptionsSchema = {
  query: z.object({
    status: z.enum(['active', 'draft', 'archived', 'all']).optional().default('all'),
    search: z.string().trim().max(160).optional().default(''),
  }),
};

export const compareJobDescriptionsSchema = z.object({
  body: z.object({
    jobDescriptionIds: z.array(objectId).min(2, 'Select at least two job descriptions').max(4),
  }),
});

export const setWordPressMappingSchema = z.object({
  params: z.object({ jobDescriptionId: objectId }),
  body: z.object({
    externalJobId: z.string().trim().min(1).max(120),
    externalJobTitle: z.string().trim().max(160).optional().default(''),
    externalJobUrl: z.string().trim().url().max(1000).optional().or(z.literal('')).default(''),
    acceptWebsiteApplications: z.boolean().optional().default(true),
  }),
});
