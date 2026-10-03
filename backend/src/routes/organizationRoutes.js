import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import { getOrganization, updateOrganization } from '../controllers/organizationController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { updateOrganizationSchema } from '../validators/organizationValidators.js';

const router = Router();
router.use(requireAuth);
router.get('/', getOrganization);
router.patch('/', authorize(ROLES.ADMIN), validate(updateOrganizationSchema), updateOrganization);

export default router;
