import { z } from 'zod';

export const recommendationValues = [
  'strong_match',
  'good_match',
  'partial_match',
  'not_recommended',
];

export const resumeAnalysisSchema = z.object({
  candidateName: z.string().trim().max(160),
  email: z.string().trim().max(200),
  phone: z.string().trim().max(80),
  currentRole: z.string().trim().max(200),
  totalExperienceYears: z.number().min(0).max(80),
  skills: z.array(z.string().trim().min(1).max(100)).max(60),
  matchedSkills: z.array(z.string().trim().min(1).max(100)).max(40),
  missingSkills: z.array(z.string().trim().min(1).max(100)).max(40),
  strengths: z.array(z.string().trim().min(1).max(300)).max(10),
  concerns: z.array(z.string().trim().min(1).max(300)).max(10),
  education: z.array(z.string().trim().min(1).max(250)).max(10),
  matchScore: z.number().int().min(0).max(100),
  recommendation: z.enum(recommendationValues),
  summary: z.string().trim().min(1).max(1500),
});

export const resumeAnalysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'candidateName',
    'email',
    'phone',
    'currentRole',
    'totalExperienceYears',
    'skills',
    'matchedSkills',
    'missingSkills',
    'strengths',
    'concerns',
    'education',
    'matchScore',
    'recommendation',
    'summary',
  ],
  properties: {
    candidateName: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    currentRole: { type: 'string' },
    totalExperienceYears: { type: 'number', minimum: 0, maximum: 80 },
    skills: {
      type: 'array',
      maxItems: 60,
      items: { type: 'string' },
    },
    matchedSkills: {
      type: 'array',
      maxItems: 40,
      items: { type: 'string' },
    },
    missingSkills: {
      type: 'array',
      maxItems: 40,
      items: { type: 'string' },
    },
    strengths: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string' },
    },
    concerns: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string' },
    },
    education: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string' },
    },
    matchScore: { type: 'integer', minimum: 0, maximum: 100 },
    recommendation: {
      type: 'string',
      enum: recommendationValues,
    },
    summary: { type: 'string' },
  },
};
