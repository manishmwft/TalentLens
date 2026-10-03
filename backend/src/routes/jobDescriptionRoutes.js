import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import {
  archiveJobDescription,
  compareJobDescriptions,
  createJobDescription,
  getJobDescription,
  listJobDescriptions,
  listWordPressJobs,
  removeWordPressMapping,
  setWordPressMapping,
  updateJobDescription,
} from '../controllers/jobDescriptionController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  compareJobDescriptionsSchema,
  createJobDescriptionSchema,
  jobDescriptionIdSchema,
  listJobDescriptionsSchema,
  setWordPressMappingSchema,
  updateJobDescriptionSchema,
} from '../validators/jobDescriptionValidators.js';

const router = Router();
const canViewJDs = authorize(ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER);
const canManageJDs = authorize(ROLES.ADMIN, ROLES.RECRUITER);

router.use(requireAuth);

router.get('/', canViewJDs, validate(listJobDescriptionsSchema), listJobDescriptions);
router.get('/wordpress/jobs', canViewJDs, listWordPressJobs);
router.post('/compare', canViewJDs, validate(compareJobDescriptionsSchema), compareJobDescriptions);
router.post('/', canManageJDs, validate(createJobDescriptionSchema), createJobDescription);

router.get('/:jobDescriptionId', canViewJDs, validate(jobDescriptionIdSchema), getJobDescription);
router.patch('/:jobDescriptionId', canManageJDs, validate(updateJobDescriptionSchema), updateJobDescription);
router.delete('/:jobDescriptionId', canManageJDs, validate(jobDescriptionIdSchema), archiveJobDescription);

router.put(
  '/:jobDescriptionId/wordpress-mapping',
  canManageJDs,
  validate(setWordPressMappingSchema),
  setWordPressMapping,
);
router.delete(
  '/:jobDescriptionId/wordpress-mapping',
  canManageJDs,
  validate(jobDescriptionIdSchema),
  removeWordPressMapping,
);

export default router;
