import { z } from 'zod';
const optionalText = (max) => z.string().trim().max(max).optional();
export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80), avatarUrl: optionalText(500), employeeId: optionalText(60),
    department: optionalText(100), designation: optionalText(100), phone: optionalText(40), alternatePhone: optionalText(40),
    dateOfBirth: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()]).optional(),
    gender: optionalText(40), bio: optionalText(1500), skills: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    linkedinUrl: optionalText(300), githubUrl: optionalText(300), timezone: optionalText(80), language: optionalText(60),
    address: z.object({ line1: optionalText(180), line2: optionalText(180), city: optionalText(80), state: optionalText(80), country: optionalText(80), postalCode: optionalText(20) }).optional(),
    emergencyContact: z.object({ name: optionalText(100), relationship: optionalText(60), phone: optionalText(40) }).optional(),
  }),
});
export const changePasswordSchema = z.object({ body: z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(72) }) });
