import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import {
  addCustomQuestion,
  assignInterview,
  deleteQuestion,
  evaluateQuestionAnswer,
  generateQuestionSet,
  getInterview,
  listInterviews,
  listInterviewers,
  reorderQuestions,
  saveQuestionResponse,
  submitFinalFeedback,
  updateInterviewStatus,
  updateQuestion,
} from '../controllers/interviewController.js';
import { requireAuth } from '../middleware/auth.js';
import { streamInterviewAnswerMedia } from '../controllers/interviewMediaController.js';
import {
  approveAutomatedInterviewResult,
  recalculateAutomatedInterviewResult,
} from '../controllers/automatedInterviewReviewController.js';
import { retryAutomatedAnswerEvaluation } from '../controllers/interviewAutomatedEvaluationController.js';
import { retryInterviewAnswerTranscription } from '../controllers/interviewTranscriptionController.js';
import { interviewAnswerMediaSchema } from '../validators/interviewMediaValidators.js';
import {
  automatedInterviewResultParamsSchema,
  automatedInterviewReviewSchema,
} from '../validators/automatedInterviewReviewValidators.js';
import { retryAutomatedEvaluationSchema } from '../validators/interviewAutomatedEvaluationValidators.js';
import { retryTranscriptionSchema } from '../validators/interviewTranscriptionValidators.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  customQuestionSchema,
  finalFeedbackSchema,
  interviewAssignmentSchema,
  interviewIdSchema,
  interviewStatusSchema,
  questionEvaluationSchema,
  questionGenerationSchema,
  questionIdSchema,
  questionResponseSchema,
  questionUpdateSchema,
  reorderQuestionsSchema,
} from '../validators/interviewValidators.js';

const router = Router();
const ALL_ROLES = [ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER, ROLES.INTERVIEWER];
const MANAGER_ROLES = [ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER];

router.use(requireAuth);
router.get('/', authorize(...ALL_ROLES), listInterviews);
router.get('/interviewers', authorize(...MANAGER_ROLES), listInterviewers);
router.post('/:screeningId/candidates/:candidateId', authorize(...MANAGER_ROLES), validate(interviewAssignmentSchema), assignInterview);
router.patch('/:interviewId/status', authorize(...ALL_ROLES), validate(interviewStatusSchema), updateInterviewStatus);
router.post('/:interviewId/questions/generate', authorize(...MANAGER_ROLES), validate(questionGenerationSchema), generateQuestionSet);
router.post('/:interviewId/questions', authorize(...MANAGER_ROLES), validate(customQuestionSchema), addCustomQuestion);
router.put('/:interviewId/questions/reorder', authorize(...MANAGER_ROLES), validate(reorderQuestionsSchema), reorderQuestions);
router.patch('/:interviewId/questions/:questionId', authorize(...ALL_ROLES), validate(questionUpdateSchema), updateQuestion);
router.put('/:interviewId/questions/:questionId/response', authorize(...ALL_ROLES), validate(questionResponseSchema), saveQuestionResponse);
router.post('/:interviewId/questions/:questionId/evaluate', authorize(...ALL_ROLES), validate(questionEvaluationSchema), evaluateQuestionAnswer);
router.delete('/:interviewId/questions/:questionId', authorize(...MANAGER_ROLES), validate(questionIdSchema), deleteQuestion);
router.post('/:interviewId/final-feedback', authorize(...ALL_ROLES), validate(finalFeedbackSchema), submitFinalFeedback);
router.post('/:interviewId/answers/:answerId/transcription/retry', authorize(...MANAGER_ROLES), validate(retryTranscriptionSchema), retryInterviewAnswerTranscription);
router.post('/:interviewId/answers/:answerId/evaluation/retry', authorize(...MANAGER_ROLES), validate(retryAutomatedEvaluationSchema), retryAutomatedAnswerEvaluation);
router.post('/:interviewId/automated-result/recalculate', authorize(...MANAGER_ROLES), validate(automatedInterviewResultParamsSchema), recalculateAutomatedInterviewResult);
router.post('/:interviewId/automated-result/review', authorize(...MANAGER_ROLES), validate(automatedInterviewReviewSchema), approveAutomatedInterviewResult);
router.get('/:interviewId/answers/:answerId/:mediaType', authorize(...ALL_ROLES), validate(interviewAnswerMediaSchema), streamInterviewAnswerMedia);
router.get('/:interviewId', authorize(...ALL_ROLES), validate(interviewIdSchema), getInterview);

export default router;
