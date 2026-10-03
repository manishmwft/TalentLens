import { Router } from 'express';
import { dashboardAnalytics } from '../controllers/analyticsController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { dashboardAnalyticsSchema } from '../validators/analyticsValidators.js';

const router = Router();
router.use(requireAuth);
router.get('/', validate(dashboardAnalyticsSchema), dashboardAnalytics);

export default router;
