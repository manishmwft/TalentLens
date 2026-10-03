import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import {
  createAutomatedInterviewWorkspace,
  inviteCandidateToAutomatedInterview,
  sendCandidateAutomatedInterviewInvitation,
} from '../controllers/candidateInvitationController.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  automatedInterviewDraftSchema,
  automatedInterviewInvitationSchema,
  automatedInterviewSendSchema,
} from '../validators/candidateInvitationValidators.js';

const router = Router();
router.use(requireAuth);
const managers = authorize(ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER);

router.post(
  '/:screeningId/candidates/:candidateId/draft',
  managers,
  validate(automatedInterviewDraftSchema),
  createAutomatedInterviewWorkspace,
);

router.post(
  '/:interviewId/send-invite',
  managers,
  validate(automatedInterviewSendSchema),
  sendCandidateAutomatedInterviewInvitation,
);

// Kept so older frontend versions do not crash.
router.post(
  '/:screeningId/candidates/:candidateId/automated-invite',
  managers,
  validate(automatedInterviewInvitationSchema),
  inviteCandidateToAutomatedInterview,
);

export default router;
