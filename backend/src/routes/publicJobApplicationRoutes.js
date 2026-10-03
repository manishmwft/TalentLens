import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { uploadResumes } from '../config/upload.js';
import { createPublicJobApplication } from '../controllers/websiteApplicationController.js';
import { requireWordPressIntegration } from '../middleware/wordpressIntegrationAuth.js';
import { validateWebsiteApplicationMultipart } from '../validators/websiteApplicationValidators.js';

const router = Router();

const websiteApplicationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many website application requests. Please retry later.',
  },
});

router.post(
  '/job-applications',
  websiteApplicationLimiter,
  requireWordPressIntegration,
  uploadResumes.single('resume'),
  validateWebsiteApplicationMultipart,
  createPublicJobApplication,
);

export default router;
