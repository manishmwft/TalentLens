import { z } from 'zod';

const password = z.string().min(8, 'Password must contain at least 8 characters').max(72, 'Password must not exceed 72 characters');
const email = z.string().trim().email('Enter a valid email address').transform((value) => value.toLowerCase());

export const candidateLoginSchema = { body: z.object({ email, password: z.string().min(1, 'Password is required').max(72) }) };

export const candidateChangePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required').max(72),
    newPassword: password,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  }).superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) context.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'New password and confirmation do not match' });
    if (value.currentPassword === value.newPassword) context.addIssue({ code: z.ZodIssueCode.custom, path: ['newPassword'], message: 'New password must be different from the current password' });
  }),
};

export const candidateForgotPasswordSchema = { body: z.object({ email }) };

export const candidateResetPasswordSchema = {
  body: z.object({ token: z.string().min(32, 'Invalid reset token').max(300), newPassword: password, confirmPassword: z.string().min(1) }).superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) context.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'New password and confirmation do not match' });
  }),
};

export const candidateProfileSchema = {
  body: z.object({
    phone: z.string().trim().max(40).optional().default(''),
    alternatePhone: z.string().trim().max(40).optional().default(''),
    currentCompany: z.string().trim().max(160).optional().default(''),
    currentRole: z.string().trim().max(160).optional().default(''),
    experienceYears: z.coerce.number().min(0).max(60).optional().default(0),
    education: z.string().trim().max(1000).optional().default(''),
    skills: z.array(z.string().trim().min(1).max(100)).max(50).optional().default([]),
    address: z.object({
      line1: z.string().trim().max(240).optional().default(''),
      city: z.string().trim().max(100).optional().default(''),
      state: z.string().trim().max(100).optional().default(''),
      country: z.string().trim().max(100).optional().default(''),
      postalCode: z.string().trim().max(30).optional().default(''),
    }).optional().default({}),
    timezone: z.string().trim().max(100).optional().default('Asia/Kolkata'),
    language: z.string().trim().max(20).optional().default('en'),
  }),
};

export const candidateInterviewIdSchema = { params: z.object({ interviewId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid interview identifier') }) };

export const candidateConsentSchema = {
  params: candidateInterviewIdSchema.params,
  body: z.object({
    recordingAccepted: z.literal(true, { errorMap: () => ({ message: 'Audio and video recording consent is required' }) }),
    aiEvaluationAccepted: z.literal(true, { errorMap: () => ({ message: 'AI-assisted evaluation consent is required' }) }),
    monitoringAccepted: z.literal(true, { errorMap: () => ({ message: 'Interview monitoring consent is required' }) }),
    privacyAccepted: z.literal(true, { errorMap: () => ({ message: 'Privacy policy acceptance is required' }) }),
    version: z.string().trim().min(1).max(50).default('1.0'),
  }),
};

export const candidateDeviceCheckSchema = {
  params: candidateInterviewIdSchema.params,
  body: z.object({
    microphonePassed: z.boolean(),
    cameraPassed: z.boolean(),
    speakerPassed: z.boolean(),
    browserSupported: z.boolean(),
    connectionPassed: z.boolean(),
    metadata: z.record(z.unknown()).optional().default({}),
  }),
};
