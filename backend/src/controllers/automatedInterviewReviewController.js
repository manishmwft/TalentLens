import { asyncHandler } from '../utils/asyncHandler.js';
import {
  calculateFinalAutomatedInterviewEvaluation,
  reviewFinalAutomatedInterviewEvaluation,
} from '../services/finalAutomatedInterviewEvaluationService.js';

export const recalculateAutomatedInterviewResult = asyncHandler(async (req, res) => {
  const result = await calculateFinalAutomatedInterviewEvaluation(
    req.params.interviewId,
    { force: req.body.force },
  );
  res.status(result.ready ? 200 : 202).json({
    success: true,
    message: result.ready
      ? 'Automated interview result is ready for staff review'
      : 'Automated interview answers are still processing',
    ready: result.ready,
    evaluatedCount: result.evaluatedCount,
    totalQuestions: result.totalQuestions,
    pendingCount: result.pendingCount,
    finalEvaluation: result.attempt?.finalEvaluation || null,
  });
});

export const approveAutomatedInterviewResult = asyncHandler(async (req, res) => {
  const attempt = await reviewFinalAutomatedInterviewEvaluation({
    interviewId: req.params.interviewId,
    organizationId: req.user.organization,
    reviewer: req.user,
    payload: req.body,
  });
  res.json({
    success: true,
    message: 'Automated interview result approved',
    finalEvaluation: attempt.finalEvaluation,
  });
});
