import { z } from 'zod';
const optionalText = (max) => z.string().trim().max(max).optional();
export const updateOrganizationSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120), legalName: optionalText(160), industry: optionalText(100),
    companySize: optionalText(50), foundedYear: z.union([z.number().int().min(1800).max(2200), z.null()]).optional(),
    website: optionalText(300), email: z.union([z.string().trim().email(), z.literal('')]).optional(), phone: optionalText(40),
    taxId: optionalText(80), registrationNumber: optionalText(80), description: optionalText(2500), logoUrl: optionalText(500),
    brandColor: optionalText(20), linkedinUrl: optionalText(300), twitterUrl: optionalText(300),
    address: z.object({ line1: optionalText(180), line2: optionalText(180), city: optionalText(80), state: optionalText(80), country: optionalText(80), postalCode: optionalText(20) }).optional(),
    timezone: optionalText(80), dateFormat: optionalText(30), currency: optionalText(10),
    defaultHiringEmail: z.union([z.string().trim().email(), z.literal('')]).optional(),
    defaultInterviewDuration: z.number().int().min(10).max(480).optional(), workingDays: z.array(z.string().trim().min(1).max(20)).max(7).optional(),
  }),
});
