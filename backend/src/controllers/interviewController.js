import { Candidate } from '../models/Candidate.js';
import { Interview } from '../models/Interview.js';
import { InterviewAnswer } from '../models/InterviewAnswer.js';
import { InterviewAttempt } from '../models/InterviewAttempt.js';
import { Screening } from '../models/Screening.js';
import { User } from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import { evaluateInterviewAnswer } from '../services/interviewAnswerEvaluationService.js';
import { generateInterviewQuestions } from '../services/interviewQuestionService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const MANAGER_ROLES = [ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER];

function serializeQuestion(question) {
  return {
    id: question._id.toString(),
    question: question.question,
    category: question.category,
    difficulty: question.difficulty,
    reason: question.reason,
    expectedPoints: question.expectedPoints || [],
    followUpQuestions: question.followUpQuestions || [],
    evaluationGuidance: question.evaluationGuidance,
    source: question.source,
    order: question.order,
    isAsked: question.isAsked,
    interviewerNotes: question.interviewerNotes,
    candidateAnswer: question.candidateAnswer || '',
    interviewerScore: question.interviewerScore || 0,
    technicalAccuracy: question.technicalAccuracy || 0,
    communicationQuality: question.communicationQuality || 0,
    confidenceLevel: question.confidenceLevel || '',
    interviewerComments: question.interviewerComments || '',
    followUpOutcome: question.followUpOutcome || '',
    answeredAt: question.answeredAt || null,
    aiEvaluation: question.aiEvaluation || null,
  };
}

function serializeFinalFeedback(feedback) {
  if (!feedback) return null;
  return {
    technicalScore: feedback.technicalScore || 0,
    communicationScore: feedback.communicationScore || 0,
    problemSolvingScore: feedback.problemSolvingScore || 0,
    roleFitScore: feedback.roleFitScore || 0,
    overallScore: feedback.overallScore || 0,
    recommendation: feedback.recommendation || '',
    strengths: feedback.strengths || '',
    concerns: feedback.concerns || '',
    finalComments: feedback.finalComments || '',
    submittedBy: feedback.submittedBy?.toString?.() || feedback.submittedBy || null,
    submittedAt: feedback.submittedAt || null,
  };
}

function serializeInterview(interview, includeDetail = false) {
  const candidate = interview.candidate;
  const screening = interview.screening;
  const interviewer = interview.interviewer;
  const assignedBy = interview.assignedBy;
  const answeredQuestionCount = interview.questions?.filter((item) => String(item.candidateAnswer || '').trim()).length || 0;
  const scoredQuestions = interview.questions?.filter((item) => Number(item.interviewerScore) > 0) || [];
  const averageQuestionScore = scoredQuestions.length
    ? Number((scoredQuestions.reduce((sum, item) => sum + Number(item.interviewerScore || 0), 0) / scoredQuestions.length).toFixed(1))
    : 0;

  const base = {
    id: interview._id.toString(),
    screeningId: screening?._id?.toString?.() || String(screening || ''),
    candidateId: candidate?._id?.toString?.() || String(candidate || ''),
    candidateName: candidate?.analysis?.candidateName || candidate?.originalFileName || 'Candidate',
    candidateRole: candidate?.analysis?.currentRole || '',
    matchScore: candidate?.analysis?.matchScore ?? null,
    jobDescriptionId: screening?.jobDescriptionRef?.toString?.() || screening?.jobDescriptionRef || null,
    jobDescriptionTitle: screening?.jobDescriptionTitle || '',
    interviewer: interviewer ? { id: interviewer._id.toString(), name: interviewer.name, email: interviewer.email } : null,
    assignedBy: assignedBy ? { id: assignedBy._id.toString(), name: assignedBy.name } : null,
    deliveryMode: interview.deliveryMode || 'human_led',
    candidateEmail: candidate?.analysis?.email || '',
    scheduledAt: interview.scheduledAt,
    automatedConfig: interview.automatedConfig || null,
    candidateAccountId: interview.candidateAccount?.toString?.() || interview.candidateAccount || null,
    durationMinutes: interview.durationMinutes,
    mode: interview.mode,
    meetingLink: interview.meetingLink,
    location: interview.location,
    instructions: interview.instructions,
    status: interview.status,
    questionSetTitle: interview.questionSetTitle || '',
    questionCount: interview.questions?.length || 0,
    askedQuestionCount: interview.questions?.filter((item) => item.isAsked).length || 0,
    answeredQuestionCount,
    averageQuestionScore,
    finalFeedback: serializeFinalFeedback(interview.finalFeedback),
    completedAt: interview.completedAt || null,
    createdAt: interview.createdAt,
    updatedAt: interview.updatedAt,
  };

  if (!includeDetail) return base;

  return {
    ...base,
    jobDescription: screening?.jobDescription || '',
    candidate: candidate
      ? {
          id: candidate._id.toString(),
          originalFileName: candidate.originalFileName,
          analysis: candidate.analysis || null,
          workflowStatus: candidate.workflowStatus,
        }
      : null,
    questionGeneration: interview.questionGeneration || null,
    questions: [...(interview.questions || [])]
      .sort((a, b) => a.order - b.order)
      .map(serializeQuestion),
  };
}

async function populatedInterview(query, includeText = false) {
  const candidateFields = includeText
    ? 'originalFileName analysis workflowStatus extractedText'
    : 'originalFileName analysis workflowStatus';
  return query
    .populate('candidate', candidateFields)
    .populate('screening', 'jobDescription jobDescriptionTitle jobDescriptionRef')
    .populate('interviewer', 'name email role')
    .populate('assignedBy', 'name email');
}

async function findAccessibleInterview(req, includeText = false) {
  const filter = { _id: req.params.interviewId, organization: req.user.organization };
  if (req.user.role === ROLES.INTERVIEWER) filter.interviewer = req.user._id;
  const interview = await populatedInterview(Interview.findOne(filter), includeText);
  if (!interview) throw new AppError('Interview not found', 404);
  return interview;
}

function ensureManager(req) {
  if (!MANAGER_ROLES.includes(req.user.role)) {
    throw new AppError('Only an Admin, Recruiter, or Hiring Manager can modify the question set', 403);
  }
}

export const listInterviewers = asyncHandler(async (req, res) => {
  const users = await User.find({
    organization: req.user.organization,
    role: ROLES.INTERVIEWER,
    isActive: true,
  }).select('name email role').sort({ name: 1 });
  res.json({ success: true, interviewers: users.map((user) => ({ id: user._id.toString(), name: user.name, email: user.email })) });
});

export const assignInterview = asyncHandler(async (req, res) => {
  const screening = await Screening.findOne({ _id: req.params.screeningId, organization: req.user.organization });
  if (!screening) throw new AppError('Screening not found', 404);
  const candidate = await Candidate.findOne({ _id: req.params.candidateId, screening: screening._id });
  if (!candidate) throw new AppError('Candidate not found', 404);
  const interviewer = await User.findOne({ _id: req.body.interviewerId, organization: req.user.organization, role: ROLES.INTERVIEWER, isActive: true });
  if (!interviewer) throw new AppError('Active interviewer not found', 404);

  let interview = await Interview.findOne({ candidate: candidate._id, status: { $in: ['scheduled', 'in_progress'] } });
  if (interview) {
    Object.assign(interview, { interviewer: interviewer._id, assignedBy: req.user._id, ...req.body, status: 'scheduled' });
  } else {
    interview = new Interview({ organization: req.user.organization, screening: screening._id, candidate: candidate._id, interviewer: interviewer._id, assignedBy: req.user._id, ...req.body, status: 'scheduled' });
  }
  await interview.save();
  if (candidate.workflowStatus !== 'interview') { candidate.workflowStatus = 'interview'; await candidate.save(); }
  interview = await populatedInterview(Interview.findById(interview._id));
  res.status(201).json({ success: true, interview: serializeInterview(interview) });
});

export const listInterviews = asyncHandler(async (req, res) => {
  const filter = { organization: req.user.organization };
  if (req.user.role === ROLES.INTERVIEWER) filter.interviewer = req.user._id;
  const interviews = await populatedInterview(Interview.find(filter).sort({ scheduledAt: 1 }));
  res.json({ success: true, interviews: interviews.map((item) => serializeInterview(item)) });
});

export const getInterview = asyncHandler(async (req, res) => {
  const interview = await findAccessibleInterview(req, false);
  const serialized = serializeInterview(interview, true);

  if (interview.deliveryMode === 'automated_ai') {
    const answers = await InterviewAnswer.find({
      interview: interview._id,
      organization: req.user.organization,
    }).sort({ order: 1, createdAt: -1 });

    const latestAttempt = await InterviewAttempt.findOne({
      interview: interview._id,
      organization: req.user.organization,
    })
      .sort({ attemptNumber: -1 })
      .populate('finalEvaluation.staffReview.reviewedBy', 'name email role');

    serialized.automatedAttempt = latestAttempt
      ? {
          id: latestAttempt._id.toString(),
          status: latestAttempt.status,
          attemptNumber: latestAttempt.attemptNumber,
          integrityEvents: latestAttempt.integrityEvents || [],
          finalEvaluation: latestAttempt.finalEvaluation || null,
        }
      : null;

    serialized.automatedAnswers = answers.map((answer) => ({
      id: answer._id.toString(),
      questionId: answer.questionId.toString(),
      order: answer.order,
      status: answer.status,
      retryCount: answer.retryCount,
      uploadError: answer.uploadError || '',
      submittedAt: answer.submittedAt || null,
      audio: {
        available: Boolean(answer.audio?.filePath),
        mimeType: answer.audio?.mimeType || '',
        sizeBytes: answer.audio?.sizeBytes || 0,
        durationSeconds: answer.audio?.durationSeconds || 0,
        verifiedAt: answer.audio?.verifiedAt || null,
        url: answer.audio?.filePath
          ? `/api/v1/interviews/${interview._id}/answers/${answer._id}/audio`
          : '',
      },
      video: {
        available: Boolean(answer.video?.filePath),
        mimeType: answer.video?.mimeType || '',
        sizeBytes: answer.video?.sizeBytes || 0,
        durationSeconds: answer.video?.durationSeconds || 0,
        verifiedAt: answer.video?.verifiedAt || null,
        url: answer.video?.filePath
          ? `/api/v1/interviews/${interview._id}/answers/${answer._id}/video`
          : '',
      },
      transcription: {
        status: answer.transcription?.status || 'pending',
        text: answer.transcription?.text || '',
        provider: answer.transcription?.provider || '',
        model: answer.transcription?.model || '',
        language: answer.transcription?.language || '',
        confidence: answer.transcription?.confidence ?? null,
        error: answer.transcription?.error || '',
        attempts: answer.transcription?.attempts || 0,
        startedAt: answer.transcription?.startedAt || null,
        completedAt: answer.transcription?.completedAt || null,
      },
      transcription: {
        status: answer.transcription?.status || 'pending',
        text: answer.transcription?.text || '',
        provider: answer.transcription?.provider || '',
        model: answer.transcription?.model || '',
        language: answer.transcription?.language || '',
        confidence: answer.transcription?.confidence ?? null,
        error: answer.transcription?.error || '',
        attempts: answer.transcription?.attempts || 0,
        startedAt: answer.transcription?.startedAt || null,
        completedAt: answer.transcription?.completedAt || null,
      },
      evaluation: {
        status: answer.evaluation?.status || 'pending',
        coverageScore: answer.evaluation?.coverageScore || 0,
        technicalCorrectness: answer.evaluation?.technicalCorrectness || 0,
        communicationClarity: answer.evaluation?.communicationClarity || 0,
        relevanceScore: answer.evaluation?.relevanceScore || 0,
        suggestedScore: answer.evaluation?.suggestedScore || 0,
        coveredPoints: answer.evaluation?.coveredPoints || [],
        missingPoints: answer.evaluation?.missingPoints || [],
        strengths: answer.evaluation?.strengths || [],
        concerns: answer.evaluation?.concerns || [],
        feedback: answer.evaluation?.feedback || '',
        suggestedFollowUp: answer.evaluation?.suggestedFollowUp || '',
        provider: answer.evaluation?.provider || '',
        model: answer.evaluation?.model || '',
        error: answer.evaluation?.error || '',
        attempts: answer.evaluation?.attempts || 0,
        startedAt: answer.evaluation?.startedAt || null,
        completedAt: answer.evaluation?.completedAt || null,
        evaluatedAt: answer.evaluation?.evaluatedAt || null,
      },
      transcriptionStatus: answer.transcription?.status || 'pending',
      evaluationStatus: answer.evaluation?.status || (
        answer.evaluation?.evaluatedAt ? 'completed' : 'pending'
      ),
    }));
  }

  res.json({ success: true, interview: serialized });
});

export const updateInterviewStatus = asyncHandler(async (req, res) => {
  let interview = await findAccessibleInterview(req, false);
  interview.status = req.body.status;
  if (req.body.status === 'completed') interview.completedAt = new Date();
  await interview.save();
  interview = await populatedInterview(Interview.findById(interview._id));
  res.json({ success: true, interview: serializeInterview(interview) });
});

export const generateQuestionSet = asyncHandler(async (req, res) => {
  ensureManager(req);
  let interview = await findAccessibleInterview(req, true);
  const result = await generateInterviewQuestions({ interview, candidate: interview.candidate, screening: interview.screening, ...req.body });
  const existingQuestions = interview.questions || [];
  const generatedQuestions = result.questions.map((question, index) => ({
    ...question,
    source: 'ai',
    order: existingQuestions.length + index,
    isAsked: false,
    interviewerNotes: '',
  }));

  if (existingQuestions.length + generatedQuestions.length > 15) {
    throw new AppError(
      `An interview can contain at most 15 questions. This interview already has ${existingQuestions.length}.`,
      400,
    );
  }

  interview.questionSetTitle = interview.questionSetTitle || result.title;
  interview.questions.push(...generatedQuestions);
  interview.questionGeneration = { category: req.body.category, difficulty: req.body.difficulty, count: generatedQuestions.length, provider: result.provider, model: result.model, responseId: result.responseId, generatedBy: req.user._id, generatedAt: new Date() };
  await interview.save();
  interview = await populatedInterview(Interview.findById(interview._id));
  res.json({ success: true, message: 'Interview questions generated', interview: serializeInterview(interview, true) });
});

export const addCustomQuestion = asyncHandler(async (req, res) => {
  ensureManager(req);
  let interview = await findAccessibleInterview(req, false);
  interview.questions.push({ ...req.body, source: 'custom', order: interview.questions.length });
  await interview.save();
  interview = await populatedInterview(Interview.findById(interview._id));
  res.status(201).json({ success: true, interview: serializeInterview(interview, true) });
});

export const updateQuestion = asyncHandler(async (req, res) => {
  let interview = await findAccessibleInterview(req, false);
  const question = interview.questions.id(req.params.questionId);
  if (!question) throw new AppError('Question not found', 404);
  const managerFields = ['question', 'category', 'difficulty', 'reason', 'expectedPoints', 'followUpQuestions', 'evaluationGuidance'];
  const progressFields = ['isAsked', 'interviewerNotes'];
  const allowed = MANAGER_ROLES.includes(req.user.role) ? [...managerFields, ...progressFields] : progressFields;
  for (const field of allowed) if (Object.prototype.hasOwnProperty.call(req.body, field)) question[field] = req.body[field];
  await interview.save();
  interview = await populatedInterview(Interview.findById(interview._id));
  res.json({ success: true, interview: serializeInterview(interview, true) });
});

export const saveQuestionResponse = asyncHandler(async (req, res) => {
  let interview = await findAccessibleInterview(req, false);
  const question = interview.questions.id(req.params.questionId);
  if (!question) throw new AppError('Question not found', 404);
  Object.assign(question, req.body, {
    isAsked: true,
    answeredAt: String(req.body.candidateAnswer || '').trim() ? new Date() : question.answeredAt,
  });
  await interview.save();
  interview = await populatedInterview(Interview.findById(interview._id));
  res.json({ success: true, message: 'Question response saved', interview: serializeInterview(interview, true) });
});

export const evaluateQuestionAnswer = asyncHandler(async (req, res) => {
  let interview = await findAccessibleInterview(req, false);
  const question = interview.questions.id(req.params.questionId);
  if (!question) throw new AppError('Question not found', 404);
  const candidateAnswer = String(req.body.candidateAnswer || question.candidateAnswer || '').trim();
  if (candidateAnswer.length < 10) throw new AppError('Enter the candidate answer before requesting AI evaluation', 400);
  question.candidateAnswer = candidateAnswer;
  question.isAsked = true;
  question.answeredAt = new Date();
  question.aiEvaluation = await evaluateInterviewAnswer({ question, candidateAnswer });
  await interview.save();
  interview = await populatedInterview(Interview.findById(interview._id));
  res.json({ success: true, message: 'Answer evaluated', interview: serializeInterview(interview, true) });
});

export const submitFinalFeedback = asyncHandler(async (req, res) => {
  let interview = await findAccessibleInterview(req, false);
  const ratings = [req.body.technicalScore, req.body.communicationScore, req.body.problemSolvingScore, req.body.roleFitScore];
  const overallScore = Math.round((ratings.reduce((sum, value) => sum + Number(value), 0) / 20) * 100);
  interview.finalFeedback = { ...req.body, overallScore, submittedBy: req.user._id, submittedAt: new Date() };
  interview.status = 'completed';
  interview.completedAt = new Date();
  await interview.save();
  interview = await populatedInterview(Interview.findById(interview._id));
  res.json({ success: true, message: 'Final interview feedback submitted', interview: serializeInterview(interview, true) });
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  ensureManager(req);
  let interview = await findAccessibleInterview(req, false);
  const question = interview.questions.id(req.params.questionId);
  if (!question) throw new AppError('Question not found', 404);
  question.deleteOne();
  interview.questions.forEach((item, index) => { item.order = index; });
  await interview.save();
  interview = await populatedInterview(Interview.findById(interview._id));
  res.json({ success: true, interview: serializeInterview(interview, true) });
});

export const reorderQuestions = asyncHandler(async (req, res) => {
  ensureManager(req);
  let interview = await findAccessibleInterview(req, false);
  const currentIds = new Set(interview.questions.map((item) => item._id.toString()));
  if (req.body.questionIds.length !== currentIds.size || req.body.questionIds.some((id) => !currentIds.has(id))) {
    throw new AppError('Question order must contain every existing question exactly once', 400);
  }
  const rank = new Map(req.body.questionIds.map((id, index) => [id, index]));
  interview.questions.forEach((item) => { item.order = rank.get(item._id.toString()); });
  interview.questions.sort((a, b) => a.order - b.order);
  await interview.save();
  interview = await populatedInterview(Interview.findById(interview._id));
  res.json({ success: true, interview: serializeInterview(interview, true) });
});
