import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { CandidateAccount } from '../models/CandidateAccount.js';
import { Interview } from '../models/Interview.js';
import { Candidate } from '../models/Candidate.js';
import { Screening } from '../models/Screening.js';
import { Organization } from '../models/Organization.js';
import { INTERVIEW_DELIVERY_MODES } from '../constants/interview.js';
import { AppError } from '../utils/AppError.js';
import { sendTemplateEmail } from './email/emailService.js';
import { notifyOrganizationManagers } from './notificationService.js';
import { env } from '../config/env.js';

function temporaryPassword() {
  return `Tl!${crypto.randomBytes(7).toString('base64url')}9a`;
}

function candidateContact(candidate) {
  const email = String(candidate.analysis?.email || '').trim().toLowerCase();
  const name = String(
    candidate.analysis?.candidateName || candidate.originalFileName || 'Candidate',
  ).trim();

  if (!email) {
    throw new AppError(
      'Candidate email is required before sending an interview invitation',
      400,
    );
  }

  return { email, name };
}

async function loadContext({ organizationId, screeningId, candidateId }) {
  const [screening, candidate, organization] = await Promise.all([
    Screening.findOne({ _id: screeningId, organization: organizationId }),
    Candidate.findOne({ _id: candidateId, screening: screeningId }),
    Organization.findById(organizationId),
  ]);

  if (!screening) throw new AppError('Screening not found', 404);
  if (!candidate) throw new AppError('Candidate not found', 404);
  if (!organization) throw new AppError('Organization not found', 404);

  return { screening, candidate, organization };
}

function defaultAutomatedConfig() {
  return {
    availableFrom: null,
    expiresAt: null,
    language: 'en',
    questionTimeSeconds: 180,
    preparationTimeSeconds: 30,
    maxRecordingSeconds: 180,
    maxRetriesPerQuestion: 1,
    maxAttempts: 1,
    allowSkip: false,
    allowRecordingReview: true,
    requireAudio: true,
    requireVideo: true,
    showScoreToCandidate: true,
    monitorTabAndFocus: true,
    monitorInactivity: true,
    webcamMonitoring: true,
    invitationStatus: 'not_created',
  };
}

/**
 * Creates the automated interview workspace before any candidate account or
 * email invitation is created. Recruiters generate, edit and approve questions
 * directly on this interview record.
 */
export async function createAutomatedInterviewDraft({
  organizationId,
  screeningId,
  candidateId,
  actorId,
}) {
  const { screening, candidate } = await loadContext({
    organizationId,
    screeningId,
    candidateId,
  });

  let interview = await Interview.findOne({
    organization: organizationId,
    screening: screening._id,
    candidate: candidate._id,
    deliveryMode: INTERVIEW_DELIVERY_MODES.AUTOMATED_AI,
    status: { $ne: 'cancelled' },
  });

  const { email } = candidateContact(candidate);
  const existingAccount = await CandidateAccount.findOne({
    organization: organizationId,
    email,
  }).select('_id');

  if (!interview) {
    interview = await Interview.create({
      organization: organizationId,
      screening: screening._id,
      candidate: candidate._id,
      interviewer: null,
      assignedBy: actorId,
      deliveryMode: INTERVIEW_DELIVERY_MODES.AUTOMATED_AI,
      candidateAccount: existingAccount?._id || null,
      scheduledAt: null,
      durationMinutes: 45,
      mode: 'video',
      instructions: '',
      automatedConfig: defaultAutomatedConfig(),
      status: 'scheduled',
      questionSetTitle: 'Automated AI Interview',
      questions: [],
    });
  } else if (!interview.candidateAccount && existingAccount) {
    interview.candidateAccount = existingAccount._id;
    await interview.save();
  }

  return interview;
}

async function getOrCreateCandidateAccount({
  organizationId,
  candidate,
  organization,
  actorId,
  language,
}) {
  const { email, name } = candidateContact(candidate);

  let account = await CandidateAccount.findOne({
    organization: organizationId,
    email,
  }).select('+passwordHash');

  let password;
  let accountCreated = false;

  if (!account) {
    password = temporaryPassword();
    const passwordHash = await bcrypt.hash(password, 12);

    account = await CandidateAccount.create({
      organization: organizationId,
      email,
      passwordHash,
      candidates: [candidate._id],
      status: 'invited',
      mustChangePassword: true,
      createdBy: actorId,
      profile: {
        fullName: name,
        phone: candidate.analysis?.phone || '',
        timezone: organization.timezone || 'Asia/Kolkata',
        language: language || 'en',
      },
    });
    accountCreated = true;
  } else {
    // Existing candidate accounts are reused. Never reset their password or
    // force another password change simply because a new interview is assigned.
    if (!account.candidates.some((id) => id.equals(candidate._id))) {
      account.candidates.push(candidate._id);
    }

    account.profile.fullName = account.profile.fullName || name;
    account.profile.phone = account.profile.phone || candidate.analysis?.phone || '';
    account.profile.language = language || account.profile.language || 'en';
    await account.save();
  }

  return { account, password, email, name, accountCreated };
}

/**
 * Sends the candidate invitation only after questions have been generated and
 * approved on the same automated interview workspace.
 */
export async function sendAutomatedInterviewInvitation({
  organizationId,
  interviewId,
  actorId,
  config,
}) {
  const interview = await Interview.findOne({
    _id: interviewId,
    organization: organizationId,
    deliveryMode: INTERVIEW_DELIVERY_MODES.AUTOMATED_AI,
    status: { $ne: 'cancelled' },
  });

  if (!interview) throw new AppError('Automated interview not found', 404);
  if (!interview.questions?.length) {
    throw new AppError(
      'Generate and review at least one interview question before sending the candidate invitation',
      409,
    );
  }

  const { screening, candidate, organization } = await loadContext({
    organizationId,
    screeningId: interview.screening,
    candidateId: interview.candidate,
  });

  const { account, password, email, name, accountCreated } = await getOrCreateCandidateAccount({
    organizationId,
    candidate,
    organization,
    actorId,
    language: config.language,
  });

  interview.candidateAccount = account._id;
  interview.durationMinutes = config.durationMinutes;
  interview.instructions = config.instructions || '';
  interview.automatedConfig = {
    ...interview.automatedConfig?.toObject?.(),
    availableFrom: config.availableFrom || new Date(),
    expiresAt: config.expiresAt,
    language: config.language || 'en',
    questionTimeSeconds: config.questionTimeSeconds,
    preparationTimeSeconds: config.preparationTimeSeconds,
    maxRecordingSeconds: config.maxRecordingSeconds,
    maxRetriesPerQuestion: 1,
    maxAttempts: 1,
    allowSkip: false,
    allowRecordingReview: true,
    requireAudio: true,
    requireVideo: true,
    showScoreToCandidate: true,
    monitorTabAndFocus: true,
    monitorInactivity: true,
    webcamMonitoring: true,
    invitationStatus: 'created',
  };
  await interview.save();

  const expiresAtLabel = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: organization.timezone || 'Asia/Kolkata',
  }).format(new Date(config.expiresAt));

  const emailResult = await sendTemplateEmail({
    organization,
    candidate: candidate._id,
    candidateAccount: account._id,
    interview: interview._id,
    to: email,
    template: 'candidate_interview_invitation',
    createdBy: actorId,
    data: {
      candidateName: name,
      organizationName: organization.name,
      jobTitle: screening.jobDescription.split(/\s+/).slice(0, 8).join(' '),
      email,
      temporaryPassword: password,
      accountCreated,
      expiresAtLabel,
      loginUrl: `${env.clientUrl}/candidate/login`,
      brandColor: organization.brandColor,
    },
  });

  interview.automatedConfig.invitationStatus = 'sent';
  interview.automatedConfig.invitationSentAt = new Date();
  await interview.save();

  candidate.workflowStatus = 'interview';
  await candidate.save();

  await notifyOrganizationManagers({
    organization: organizationId,
    type: 'candidate_invited',
    title: 'Automated interview invitation sent',
    message: `${name} was invited to complete an automated interview with ${interview.questions.length} approved questions.`,
    link: `/interviews/${interview._id}`,
    entityType: 'Interview',
    entityId: interview._id,
    metadata: {
      candidateId: candidate._id,
      email,
      automatedInterviewId: interview._id,
      questionCount: interview.questions.length,
    },
  });

  return {
    interview,
    account,
    emailLog: emailResult.log,
    temporaryPassword: env.emailProvider === 'mock' && accountCreated ? password : undefined,
    accountCreated,
  };
}

/** Backward compatibility for the old one-step invitation endpoint. */
export async function createAutomatedInterviewInvitation({
  organizationId,
  screeningId,
  candidateId,
  actorId,
  config,
}) {
  const draft = await createAutomatedInterviewDraft({
    organizationId,
    screeningId,
    candidateId,
    actorId,
  });

  return sendAutomatedInterviewInvitation({
    organizationId,
    interviewId: draft._id,
    actorId,
    config,
  });
}
