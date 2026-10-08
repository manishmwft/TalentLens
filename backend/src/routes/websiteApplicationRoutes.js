import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import {
  archiveWebsiteApplication,
  autoMapWebsiteApplications,
  downloadWebsiteApplicationResume,
  getWebsiteApplication,
  listWebsiteApplications,
  recoverFailedWebsiteScreening,
} from '../controllers/websiteApplicationInboxController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  listWebsiteApplicationsSchema,
  websiteApplicationIdSchema,
} from '../validators/websiteApplicationInboxValidators.js';

const router = Router();
const canView = authorize(ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER);
const canManage = authorize(ROLES.ADMIN, ROLES.RECRUITER);

router.use(requireAuth);
router.get('/', canView, validate(listWebsiteApplicationsSchema), listWebsiteApplications);
router.post('/auto-map', canManage, autoMapWebsiteApplications);
router.get('/:applicationId', canView, validate(websiteApplicationIdSchema), getWebsiteApplication);
router.get('/:applicationId/resume', canView, validate(websiteApplicationIdSchema), downloadWebsiteApplicationResume);
router.post('/:applicationId/recover-screening', canManage, validate(websiteApplicationIdSchema), recoverFailedWebsiteScreening);
router.patch('/:applicationId/archive', canManage, validate(websiteApplicationIdSchema), archiveWebsiteApplication);

export default router;
