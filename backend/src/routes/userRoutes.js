import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import {
  createOrganizationUser,
  deleteOrganizationUser,
  listOrganizationUsers,
  resendOrganizationInvitation,
  updateOrganizationUser,
} from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createTeamMemberSchema,
  teamMemberIdSchema,
  updateTeamMemberSchema,
} from '../validators/userValidators.js';

const router = Router();
router.use(requireAuth, authorize(ROLES.ADMIN));
router.get('/', listOrganizationUsers);
router.post('/', validate(createTeamMemberSchema), createOrganizationUser);
router.patch('/:userId', validate(updateTeamMemberSchema), updateOrganizationUser);
router.post('/:userId/resend-invitation', validate(teamMemberIdSchema), resendOrganizationInvitation);
router.delete('/:userId', validate(teamMemberIdSchema), deleteOrganizationUser);

export default router;
