import { Router } from 'express';
import { createHiringDecision, getCandidateTimeline } from '../controllers/candidateLifecycleController.js';
import {
  createScreening,
  downloadCandidateResume,
  downloadScreeningCsv,
  downloadScreeningPdf,
  exportSelectedScreeningsCsv,
  getScreening,
  listScreenings,
  listComparisonCandidates,
  reanalyzeScreening,
  updateCandidateNotes,
  updateCandidateWorkflowStatus,
} from '../controllers/screeningController.js';
import { uploadResumes } from '../config/upload.js';
import { ROLES } from '../constants/roles.js';
import { requireAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { uploadErrorHandler } from '../middleware/uploadErrorHandler.js';
import { validate } from '../middleware/validate.js';
import {
  candidateNotesSchema,
  candidateResumeSchema,
  candidateWorkflowSchema,
  screeningExportSchema,
  screeningIdSchema,
} from '../validators/screeningValidators.js';
import { candidateTimelineSchema, hiringDecisionSchema } from '../validators/candidateLifecycleValidators.js';

const router = Router();
const canViewScreenings = authorize(ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER);
const canManageScreenings = authorize(ROLES.ADMIN, ROLES.RECRUITER);
const canReviewCandidates = authorize(ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER);

router.use(requireAuth);
router.get('/', canViewScreenings, listScreenings);
router.get('/comparison/candidates', canViewScreenings, listComparisonCandidates);
router.post('/export.csv', canViewScreenings, validate(screeningExportSchema), exportSelectedScreeningsCsv);
router.get('/:screeningId', canViewScreenings, validate(screeningIdSchema), getScreening);
router.get('/:screeningId/report.pdf', canViewScreenings, validate(screeningIdSchema), downloadScreeningPdf);
router.get('/:screeningId/candidates.csv', canViewScreenings, validate(screeningIdSchema), downloadScreeningCsv);
router.get('/:screeningId/candidates/:candidateId/resume', canReviewCandidates, validate(candidateResumeSchema), downloadCandidateResume);
router.get('/:screeningId/candidates/:candidateId/timeline', canReviewCandidates, validate(candidateTimelineSchema), getCandidateTimeline);
router.post('/:screeningId/candidates/:candidateId/decisions', canReviewCandidates, validate(hiringDecisionSchema), createHiringDecision);
router.patch('/:screeningId/candidates/:candidateId/status', canReviewCandidates, validate(candidateWorkflowSchema), updateCandidateWorkflowStatus);
router.patch('/:screeningId/candidates/:candidateId/notes', canReviewCandidates, validate(candidateNotesSchema), updateCandidateNotes);
router.post('/', canManageScreenings, uploadResumes.array('resumes'), uploadErrorHandler, createScreening);
router.post('/:screeningId/analyze', canManageScreenings, validate(screeningIdSchema), reanalyzeScreening);

export default router;
