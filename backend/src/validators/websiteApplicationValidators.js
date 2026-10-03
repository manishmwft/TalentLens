import fs from 'fs';
import { z } from 'zod';

const websiteApplicationBodySchema = z.object({
  externalApplicationId: z.string().trim().min(1).max(120),
  externalJobId: z.string().trim().min(1).max(120),
  jobTitle: z.string().trim().min(2).max(160),
  // Optional for backwards compatibility. New WordPress integrations should
  // send the complete job description so TalentLens can auto-create the JD
  // when no safe mapping already exists. HTML is accepted and normalized by
  // the mapping service before storing it as the TalentLens JD.
  jobDescription: z.string().trim().max(30000).optional().default(''),
  jobUrl: z.string().trim().url().max(1000).optional().or(z.literal('')).default(''),
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(80).optional().default(''),
  coverLetter: z.string().trim().max(10000).optional().default(''),
  source: z
    .literal('mushroom_world_group_website')
    .optional()
    .default('mushroom_world_group_website'),
  appliedAt: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), 'Invalid appliedAt date'),
});

function removeUploadedFile(file) {
  if (!file?.path) return;
  fs.unlink(file.path, () => {});
}

export async function validateWebsiteApplicationMultipart(req, res, next) {
  const result = await websiteApplicationBodySchema.safeParseAsync(req.body || {});

  if (!result.success) {
    removeUploadedFile(req.file);
    const errors = result.error.issues.map((issue) => ({
      field: `body.${issue.path.map(String).join('.')}`,
      message: issue.message || 'Invalid value',
      code: issue.code || 'validation_error',
    }));

    res.status(400).json({
      success: false,
      message: errors[0]?.message || 'Validation failed.',
      errors,
    });
    return;
  }

  req.body = result.data;
  next();
}
