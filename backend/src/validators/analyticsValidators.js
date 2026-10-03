import { z } from 'zod';

export const dashboardAnalyticsSchema = {
  query: z.object({
    period: z.enum(['30d', '90d', '180d', 'all']).optional().default('90d'),
  }),
};
