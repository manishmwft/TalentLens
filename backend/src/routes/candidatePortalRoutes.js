import { Router } from 'express';
import {
  acceptInterviewConsent,
  confirmInterviewInstructions,
  getCandidateInterview,
  listCandidateInterviews,
  saveInterviewDeviceCheck,
} from '../controllers/candidatePortalController.js';
import { getCandidateProfile, updateCandidateProfile } from '../controllers/candidateProfileController.js';
import { requireCandidateAuth, requireCandidatePasswordChanged } from '../middleware/candidateAuth.js';
import { uploadCandidateAnswerMedia } from '../config/candidateMediaUpload.js';
import {
  getCandidateInterviewSession,
  recordCandidateIntegrityEvent,
  startCandidateInterview,
  submitCandidateAnswer,
} from '../controllers/candidateInterviewSessionController.js';
import { validate } from '../middleware/validate.js';
import {
  candidateConsentSchema,
  candidateDeviceCheckSchema,
  candidateInterviewIdSchema,
  candidateProfileSchema,
} from '../validators/candidateAuthValidators.js';
import {
  candidateAnswerSubmissionSchema,
  candidateIntegrityEventSchema,
  candidateInterviewSessionSchema,
} from '../validators/candidateInterviewSessionValidators.js';

const router = Router();

function candidateMediaRequestTimeout(req, res, next) {
  const timeoutMs = Number(
    process.env.INTERVIEW_MEDIA_REQUEST_TIMEOUT_MS ||
      15 * 60 * 1000,
  );

  req.setTimeout(timeoutMs);
  res.setTimeout(timeoutMs);
  next();
}
router.use(requireCandidateAuth, requireCandidatePasswordChanged);
router.get('/profile', getCandidateProfile);
router.patch('/profile', validate(candidateProfileSchema), updateCandidateProfile);
router.get('/interviews', listCandidateInterviews);
router.get('/interviews/:interviewId', validate(candidateInterviewIdSchema), getCandidateInterview);
router.post('/interviews/:interviewId/consent', validate(candidateConsentSchema), acceptInterviewConsent);
router.post('/interviews/:interviewId/device-check', validate(candidateDeviceCheckSchema), saveInterviewDeviceCheck);
router.post('/interviews/:interviewId/prepare', validate(candidateInterviewIdSchema), confirmInterviewInstructions);
router.post('/interviews/:interviewId/start', validate(candidateInterviewSessionSchema), startCandidateInterview);
router.get('/interviews/:interviewId/session', validate(candidateInterviewSessionSchema), getCandidateInterviewSession);
router.post('/interviews/:interviewId/integrity-events', validate(candidateIntegrityEventSchema), recordCandidateIntegrityEvent);
router.post(
  '/interviews/:interviewId/questions/:questionId/answer',
  candidateMediaRequestTimeout,
  uploadCandidateAnswerMedia,
  validate(candidateAnswerSubmissionSchema),
  submitCandidateAnswer,
);

export default router;
