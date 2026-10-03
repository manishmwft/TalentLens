import { z } from 'zod';
import { ROLE_VALUES } from '../constants/roles.js';

export const createTeamMemberSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(72),
    role: z.enum(ROLE_VALUES),
  }),
});

export const updateTeamMemberSchema = z.object({
  params: z.object({ userId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user ID') }),
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    role: z.enum(ROLE_VALUES).optional(),
    isActive: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0, 'At least one field is required'),
});

export const teamMemberIdSchema = z.object({
  params: z.object({ userId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user ID') }),
});
