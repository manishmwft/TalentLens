import {
  createAutomatedInterviewDraft,
  createAutomatedInterviewInvitation,
  sendAutomatedInterviewInvitation,
} from '../services/candidateInvitationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function interviewSummary(interview) {
  return {
    id: interview._id.toString(),
    status: interview.status,
    deliveryMode: interview.deliveryMode,
    questionCount: interview.questions?.length || 0,
    invitationStatus: interview.automatedConfig?.invitationStatus || 'not_created',
    expiresAt: interview.automatedConfig?.expiresAt || null,
  };
}

export const createAutomatedInterviewWorkspace = asyncHandler(async (req, res) => {
  const interview = await createAutomatedInterviewDraft({
    organizationId: req.user.organization,
    screeningId: req.params.screeningId,
    candidateId: req.params.candidateId,
    actorId: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: interview.questions?.length
      ? 'Automated interview workspace opened'
      : 'Automated interview draft created. Generate and review questions before sending the invitation.',
    interview: interviewSummary(interview),
  });
});

export const sendCandidateAutomatedInterviewInvitation = asyncHandler(async (req, res) => {
  const result = await sendAutomatedInterviewInvitation({
    organizationId: req.user.organization,
    interviewId: req.params.interviewId,
    actorId: req.user._id,
    config: req.body,
  });

  res.status(201).json({
    success: true,
    message: result.accountCreated
      ? 'Candidate account created and interview invitation sent'
      : 'Existing candidate account reused and interview invitation sent',
    interview: interviewSummary(result.interview),
    candidateAccount: {
      id: result.account._id.toString(),
      email: result.account.email,
      status: result.account.status,
      mustChangePassword: result.account.mustChangePassword,
    },
    email: {
      status: result.emailLog.status,
      provider: result.emailLog.provider,
      logId: result.emailLog._id.toString(),
    },
    temporaryPassword: result.temporaryPassword,
    accountCreated: result.accountCreated,
  });
});

export const inviteCandidateToAutomatedInterview = asyncHandler(async (req, res) => {
  const result = await createAutomatedInterviewInvitation({
    organizationId: req.user.organization,
    screeningId: req.params.screeningId,
    candidateId: req.params.candidateId,
    actorId: req.user._id,
    config: req.body,
  });

  res.status(201).json({
    success: true,
    message: result.accountCreated
      ? 'Candidate account created and interview invitation sent'
      : 'Existing candidate account reused and interview invitation sent',
    interview: interviewSummary(result.interview),
    candidateAccount: {
      id: result.account._id.toString(),
      email: result.account.email,
      status: result.account.status,
      mustChangePassword: result.account.mustChangePassword,
    },
    email: {
      status: result.emailLog.status,
      provider: result.emailLog.provider,
      logId: result.emailLog._id.toString(),
    },
    temporaryPassword: result.temporaryPassword,
    accountCreated: result.accountCreated,
  });
});
