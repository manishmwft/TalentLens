import { Interview } from '../models/Interview.js';
import { InterviewAttempt } from '../models/InterviewAttempt.js';
import { INTERVIEW_ATTEMPT_STATUSES, INTERVIEW_DELIVERY_MODES } from '../constants/interview.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ensureAutomatedInterviewQuestions } from '../services/automatedInterviewQuestionService.js';

function jobTitleFromDescription(description = '') {
  const firstLine = String(description).split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return firstLine || String(description).split(/\s+/).slice(0, 8).join(' ') || 'Automated Interview';
}

function readiness(interview, now = new Date()) {
  const availableFrom = interview.automatedConfig?.availableFrom;
  const expiresAt = interview.automatedConfig?.expiresAt;
  if (interview.status === 'completed') return { canStart: false, reason: 'completed' };
  if (interview.status === 'cancelled') return { canStart: false, reason: 'cancelled' };
  if (availableFrom && availableFrom > now) return { canStart: false, reason: 'not_available' };
  if (expiresAt && expiresAt < now) return { canStart: false, reason: 'expired' };
  return { canStart: true, reason: 'ready' };
}

function attemptProgress(attempt) {
  const consentComplete = Boolean(attempt?.consent?.accepted);
  const deviceComplete = Boolean(attempt?.deviceCheck?.completedAt);
  const ready = attempt?.status === INTERVIEW_ATTEMPT_STATUSES.READY;
  const started = [INTERVIEW_ATTEMPT_STATUSES.IN_PROGRESS, INTERVIEW_ATTEMPT_STATUSES.PROCESSING, INTERVIEW_ATTEMPT_STATUSES.COMPLETED].includes(attempt?.status);
  return {
    attemptId: attempt?._id?.toString() || null,
    status: attempt?.status || INTERVIEW_ATTEMPT_STATUSES.DRAFT,
    consentComplete,
    deviceCheckComplete: deviceComplete,
    instructionsComplete: ready || started,
    sessionStarted: started,
    currentStep: !consentComplete ? 'consent' : !deviceComplete ? 'device_check' : !ready && !started ? 'instructions' : started ? 'interview' : 'ready',
  };
}

function serializeInterview(interview, detailed = false, attempt = null) {
  const ready = readiness(interview);
  const screening = interview.screening || {};
  const candidate = interview.candidate || {};
  const config = interview.automatedConfig || {};
  return {
    id: interview._id.toString(),
    title: interview.questionSetTitle || jobTitleFromDescription(screening.jobDescription),
    candidateName: candidate.analysis?.candidateName || candidate.originalFileName || 'Candidate',
    sourceFileName: candidate.originalFileName || '',
    status: interview.status,
    deliveryMode: interview.deliveryMode,
    questionCount: interview.questions?.length || interview.questionGeneration?.count || 0,
    durationMinutes: interview.durationMinutes,
    availableFrom: config.availableFrom,
    expiresAt: config.expiresAt,
    language: config.language || 'en',
    questionTimeSeconds: config.questionTimeSeconds || 180,
    preparationTimeSeconds: config.preparationTimeSeconds || 30,
    maxRecordingSeconds: config.maxRecordingSeconds || 180,
    maxRetriesPerQuestion: config.maxRetriesPerQuestion ?? 1,
    requireAudio: config.requireAudio !== false,
    requireVideo: config.requireVideo !== false,
    showScoreToCandidate: config.showScoreToCandidate === true,
    instructions: interview.instructions || '',
    canStart: ready.canStart,
    readinessReason: ready.reason,
    preparation: attemptProgress(attempt),
    createdAt: interview.createdAt,
    ...(detailed ? {
      jobDescriptionPreview: String(screening.jobDescription || '').split(/\s+/).slice(0, 80).join(' '),
      monitoring: {
        tabAndFocus: config.monitorTabAndFocus === true,
        inactivity: config.monitorInactivity === true,
        webcam: config.webcamMonitoring === true,
      },
      consent: attempt?.consent || null,
      deviceCheck: attempt?.deviceCheck || null,
    } : {}),
  };
}

const interviewQuery = (accountId) => ({
  candidateAccount: accountId,
  deliveryMode: INTERVIEW_DELIVERY_MODES.AUTOMATED_AI,
});

async function findInterview(req) {
  const interview = await Interview.findOne({
    _id: req.params.interviewId,
    ...interviewQuery(req.candidateAccount._id),
  })
    .populate('screening', 'jobDescription createdAt')
    .populate('candidate', 'originalFileName analysis.candidateName');
  if (!interview) throw new AppError('Interview not found', 404);
  return interview;
}

async function getOrCreateAttempt(interview, account) {
  let attempt = await InterviewAttempt.findOne({ interview: interview._id, candidateAccount: account._id }).sort({ attemptNumber: -1 });
  if (!attempt) {
    attempt = await InterviewAttempt.create({
      organization: interview.organization,
      interview: interview._id,
      candidate: interview.candidate._id || interview.candidate,
      candidateAccount: account._id,
      attemptNumber: 1,
      maxAttempts: interview.automatedConfig?.maxAttempts || 1,
      status: INTERVIEW_ATTEMPT_STATUSES.DRAFT,
      session: { expiresAt: interview.automatedConfig?.expiresAt || null },
    });
  }
  return attempt;
}

function assertAvailable(interview) {
  const state = readiness(interview);
  if (!state.canStart) {
    const messages = {
      completed: 'This interview has already been completed',
      cancelled: 'This interview has been cancelled',
      not_available: 'This interview is not available yet',
      expired: 'This interview invitation has expired',
    };
    throw new AppError(messages[state.reason] || 'This interview cannot be started', 409);
  }
}

export const listCandidateInterviews = asyncHandler(async (req, res) => {
  const interviews = await Interview.find(interviewQuery(req.candidateAccount._id))
    .populate('screening', 'jobDescription createdAt')
    .populate('candidate', 'originalFileName analysis.candidateName')
    .sort({ createdAt: -1 });
  const attempts = await InterviewAttempt.find({
    candidateAccount: req.candidateAccount._id,
    interview: { $in: interviews.map((item) => item._id) },
  }).sort({ attemptNumber: -1 });
  const byInterview = new Map();
  attempts.forEach((attempt) => {
    const key = attempt.interview.toString();
    if (!byInterview.has(key)) byInterview.set(key, attempt);
  });
  res.json({
    success: true,
    interviews: interviews.map((interview) => serializeInterview(interview, false, byInterview.get(interview._id.toString()) || null)),
  });
});

export const getCandidateInterview = asyncHandler(async (req, res) => {
  const interview = await findInterview(req);
  // Repairs automated invitations created by older builds and ensures the
  // candidate always sees the recruiter-approved question snapshot.
  await ensureAutomatedInterviewQuestions(interview, { throwWhenMissing: false });
  const attempt = await getOrCreateAttempt(interview, req.candidateAccount);
  res.json({ success: true, interview: serializeInterview(interview, true, attempt) });
});

export const acceptInterviewConsent = asyncHandler(async (req, res) => {
  const interview = await findInterview(req);
  assertAvailable(interview);
  const attempt = await getOrCreateAttempt(interview, req.candidateAccount);
  if ([INTERVIEW_ATTEMPT_STATUSES.IN_PROGRESS, INTERVIEW_ATTEMPT_STATUSES.PROCESSING, INTERVIEW_ATTEMPT_STATUSES.COMPLETED].includes(attempt.status)) {
    throw new AppError('Consent cannot be changed after the interview has started', 409);
  }
  attempt.consent = {
    accepted: true,
    recordingAccepted: req.body.recordingAccepted,
    aiEvaluationAccepted: req.body.aiEvaluationAccepted,
    monitoringAccepted: req.body.monitoringAccepted,
    privacyAccepted: req.body.privacyAccepted,
    acceptedAt: new Date(),
    version: req.body.version,
    ipAddress: req.ip || '',
    userAgent: req.get('user-agent') || '',
  };
  await attempt.save();
  res.json({ success: true, message: 'Consent recorded', preparation: attemptProgress(attempt) });
});

export const saveInterviewDeviceCheck = asyncHandler(async (req, res) => {
  const interview = await findInterview(req);
  assertAvailable(interview);
  const attempt = await getOrCreateAttempt(interview, req.candidateAccount);
  if (!attempt.consent?.accepted) throw new AppError('Accept interview consent before running the device check', 409);
  const config = interview.automatedConfig || {};
  const checks = req.body;
  const passed = checks.browserSupported && checks.connectionPassed && checks.speakerPassed
    && (!config.requireAudio || checks.microphonePassed)
    && (!config.requireVideo || checks.cameraPassed);
  attempt.deviceCheck = {
    microphonePassed: checks.microphonePassed,
    cameraPassed: checks.cameraPassed,
    speakerPassed: checks.speakerPassed,
    browserSupported: checks.browserSupported,
    connectionPassed: checks.connectionPassed,
    completedAt: passed ? new Date() : null,
    metadata: checks.metadata || {},
  };
  await attempt.save();
  res.status(passed ? 200 : 400).json({
    success: passed,
    message: passed ? 'Device check completed' : 'One or more required device checks failed',
    deviceCheck: attempt.deviceCheck,
    preparation: attemptProgress(attempt),
  });
});

export const confirmInterviewInstructions = asyncHandler(async (req, res) => {
  const interview = await findInterview(req);
  assertAvailable(interview);
  await ensureAutomatedInterviewQuestions(interview);
  const attempt = await getOrCreateAttempt(interview, req.candidateAccount);
  if (!attempt.consent?.accepted) throw new AppError('Interview consent is required', 409);
  if (!attempt.deviceCheck?.completedAt) throw new AppError('Complete the device check before continuing', 409);
  if (attempt.status === INTERVIEW_ATTEMPT_STATUSES.DRAFT) attempt.status = INTERVIEW_ATTEMPT_STATUSES.READY;
  attempt.session.lastSavedAt = new Date();
  attempt.session.lastActivityAt = new Date();
  await attempt.save();
  res.json({
    success: true,
    message: 'Interview preparation completed',
    preparation: attemptProgress(attempt),
    nextRoute: `/candidate/interviews/${interview._id}/ready`,
  });
});
