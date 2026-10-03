import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    companyName: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(72),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
    password: z.string().min(1),
  }),
});
