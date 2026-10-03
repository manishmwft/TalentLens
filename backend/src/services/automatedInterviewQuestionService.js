import { Interview } from '../models/Interview.js';
import { INTERVIEW_DELIVERY_MODES } from '../constants/interview.js';
import { AppError } from '../utils/AppError.js';

const QUESTION_FIELDS = [
  'question',
  'category',
  'difficulty',
  'reason',
  'expectedPoints',
  'followUpQuestions',
  'evaluationGuidance',
  'source',
  'order',
];

function plainValue(value) {
  if (value && typeof value.toObject === 'function') {
    return value.toObject();
  }

  return value || {};
}

function cloneQuestion(question, index) {
  const source = plainValue(question);
  const cloned = {};

  for (const field of QUESTION_FIELDS) {
    if (source[field] !== undefined) {
      cloned[field] = source[field];
    }
  }

  cloned.order = Number.isFinite(Number(source.order))
    ? Number(source.order)
    : index;

  // Candidate automated interviews must start with a clean answer state.
  cloned.isAsked = false;
  cloned.interviewerNotes = '';
  cloned.candidateAnswer = '';
  cloned.interviewerScore = 0;
  cloned.technicalAccuracy = 0;
  cloned.communicationQuality = 0;
  cloned.confidenceLevel = '';
  cloned.interviewerComments = '';
  cloned.followUpOutcome = '';
  cloned.answeredAt = null;
  cloned.aiEvaluation = null;

  return cloned;
}

function idOf(value) {
  return value?._id || value || null;
}

/**
 * Finds the latest recruiter-managed interview for the same candidate and
 * screening that already contains approved questions.
 */
export async function findApprovedQuestionSource(interview) {
  const source = await Interview.findOne({
    _id: { $ne: idOf(interview) },
    organization: idOf(interview.organization),
    screening: idOf(interview.screening),
    candidate: idOf(interview.candidate),
    'questions.0': { $exists: true },
    status: { $ne: 'cancelled' },
  })
    .sort({ 'questionGeneration.generatedAt': -1, updatedAt: -1 })
    .select('questions questionSetTitle questionGeneration deliveryMode updatedAt');

  return source;
}

/**
 * Copies recruiter-approved questions into an automated interview exactly
 * once. The copied questions become the candidate-facing immutable snapshot.
 */
export async function ensureAutomatedInterviewQuestions(
  interview,
  { actorId = null, throwWhenMissing = true } = {},
) {
  if (!interview) {
    throw new AppError('Interview not found', 404);
  }

  if (interview.deliveryMode !== INTERVIEW_DELIVERY_MODES.AUTOMATED_AI) {
    return {
      interview,
      copied: false,
      sourceInterview: null,
    };
  }

  if (Array.isArray(interview.questions) && interview.questions.length > 0) {
    return {
      interview,
      copied: false,
      sourceInterview: interview.questionSourceInterview || null,
    };
  }

  const sourceInterview = await findApprovedQuestionSource(interview);

  if (!sourceInterview) {
    if (throwWhenMissing) {
      throw new AppError(
        'Generate and approve interview questions before sending the automated interview invitation',
        409,
      );
    }

    return {
      interview,
      copied: false,
      sourceInterview: null,
    };
  }

  interview.questions = sourceInterview.questions.map(cloneQuestion);
  interview.questionSetTitle =
    sourceInterview.questionSetTitle || interview.questionSetTitle || 'Automated AI Interview';

  const sourceGeneration = plainValue(sourceInterview.questionGeneration);
  interview.questionGeneration = {
    category: sourceGeneration.category || 'mixed',
    difficulty: sourceGeneration.difficulty || 'intermediate',
    count: interview.questions.length,
    provider: sourceGeneration.provider || '',
    model: sourceGeneration.model || '',
    responseId: sourceGeneration.responseId || '',
    generatedBy: sourceGeneration.generatedBy || actorId || null,
    generatedAt: sourceGeneration.generatedAt || sourceInterview.updatedAt || new Date(),
  };

  interview.questionSourceInterview = sourceInterview._id;
  interview.questionsCopiedAt = new Date();
  interview.questionsCopiedBy = actorId || null;

  await interview.save();

  return {
    interview,
    copied: true,
    sourceInterview: sourceInterview._id,
  };
}

/**
 * Used before creating an invitation so new automated interviews never start
 * without recruiter-approved questions.
 */
export async function requireApprovedQuestionSource({
  organizationId,
  screeningId,
  candidateId,
}) {
  const sourceInterview = await Interview.findOne({
    organization: organizationId,
    screening: screeningId,
    candidate: candidateId,
    'questions.0': { $exists: true },
    status: { $ne: 'cancelled' },
  })
    .sort({ 'questionGeneration.generatedAt': -1, updatedAt: -1 })
    .select('questions questionSetTitle questionGeneration deliveryMode updatedAt');

  if (!sourceInterview) {
    throw new AppError(
      'Generate and approve interview questions before inviting the candidate',
      409,
    );
  }

  return sourceInterview;
}

export function cloneApprovedQuestions(sourceInterview) {
  return sourceInterview.questions.map(cloneQuestion);
}
