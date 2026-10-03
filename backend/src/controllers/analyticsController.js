import { getDashboardAnalytics } from '../services/analyticsService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const dashboardAnalytics = asyncHandler(async (req, res) => {
  const organizationId = req.user.organization?._id || req.user.organization;
  if (!organizationId) throw new AppError('Organization context is required', 400);

  const analytics = await getDashboardAnalytics({
    organizationId,
    period: req.query.period || '90d',
  });

  res.json({ success: true, analytics });
});
