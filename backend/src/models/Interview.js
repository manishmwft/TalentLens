import mongoose from 'mongoose';
import { INTERVIEW_DELIVERY_MODES } from '../constants/interview.js';

const aiEvaluationSchema = new mongoose.Schema(
  {
    coverageScore: { type: Number, min: 0, max: 100, default: 0 },
    technicalCorrectness: { type: Number, min: 0, max: 100, default: 0 },
    communicationClarity: { type: Number, min: 0, max: 100, default: 0 },
    suggestedScore: { type: Number, min: 0, max: 5, default: 0 },
    coveredPoints: [{ type: String, trim: true, maxlength: 300 }],
    missingPoints: [{ type: String, trim: true, maxlength: 300 }],
    feedback: { type: String, default: '', maxlength: 2000 },
    suggestedFollowUp: { type: String, default: '', maxlength: 1000 },
    provider: { type: String, default: '' },
    model: { type: String, default: '' },
    evaluatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 1000 },
    category: {
      type: String,
      enum: ['technical', 'behavioral', 'situational', 'resume_based', 'project_based', 'problem_solving', 'leadership', 'culture_fit'],
      default: 'technical',
    },
    difficulty: { type: String, enum: ['basic', 'intermediate', 'advanced'], default: 'intermediate' },
    reason: { type: String, default: '', maxlength: 1000 },
    expectedPoints: [{ type: String, trim: true, maxlength: 300 }],
    followUpQuestions: [{ type: String, trim: true, maxlength: 500 }],
    evaluationGuidance: { type: String, default: '', maxlength: 1500 },
    source: { type: String, enum: ['ai', 'custom'], default: 'ai' },
    order: { type: Number, default: 0 },
    isAsked: { type: Boolean, default: false },
    interviewerNotes: { type: String, default: '', maxlength: 5000 },

    candidateAnswer: { type: String, default: '', maxlength: 12000 },
    interviewerScore: { type: Number, min: 0, max: 5, default: 0 },
    technicalAccuracy: { type: Number, min: 0, max: 5, default: 0 },
    communicationQuality: { type: Number, min: 0, max: 5, default: 0 },
    confidenceLevel: { type: String, enum: ['', 'low', 'medium', 'high'], default: '' },
    interviewerComments: { type: String, default: '', maxlength: 5000 },
    followUpOutcome: { type: String, default: '', maxlength: 3000 },
    answeredAt: { type: Date, default: null },
    aiEvaluation: { type: aiEvaluationSchema, default: null },
  },
  { timestamps: true },
);

const finalFeedbackSchema = new mongoose.Schema(
  {
    technicalScore: { type: Number, min: 0, max: 5, default: 0 },
    communicationScore: { type: Number, min: 0, max: 5, default: 0 },
    problemSolvingScore: { type: Number, min: 0, max: 5, default: 0 },
    roleFitScore: { type: Number, min: 0, max: 5, default: 0 },
    overallScore: { type: Number, min: 0, max: 100, default: 0 },
    recommendation: {
      type: String,
      enum: ['', 'strong_hire', 'hire', 'hold', 'no_hire'],
      default: '',
    },
    strengths: { type: String, default: '', maxlength: 5000 },
    concerns: { type: String, default: '', maxlength: 5000 },
    finalComments: { type: String, default: '', maxlength: 10000 },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    submittedAt: { type: Date, default: null },
  },
  { _id: false },
);

const interviewSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    screening: { type: mongoose.Schema.Types.ObjectId, ref: 'Screening', required: true, index: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
    interviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deliveryMode: {
      type: String,
      enum: Object.values(INTERVIEW_DELIVERY_MODES),
      default: INTERVIEW_DELIVERY_MODES.HUMAN_LED,
      index: true,
    },
    candidateAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateAccount',
      default: null,
      index: true,
    },
    scheduledAt: { type: Date, default: null, index: true },
    durationMinutes: { type: Number, min: 15, max: 240, default: 45 },
    mode: { type: String, enum: ['video', 'phone', 'in_person'], default: 'video' },
    meetingLink: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    instructions: { type: String, default: '', maxlength: 2000 },
    automatedConfig: {
      availableFrom: { type: Date, default: null },
      expiresAt: { type: Date, default: null, index: true },
      language: { type: String, trim: true, maxlength: 30, default: 'en' },
      questionTimeSeconds: { type: Number, min: 30, max: 3600, default: 180 },
      preparationTimeSeconds: { type: Number, min: 0, max: 600, default: 30 },
      maxRecordingSeconds: { type: Number, min: 30, max: 3600, default: 180 },
      maxRetriesPerQuestion: { type: Number, min: 0, max: 10, default: 1 },
      maxAttempts: { type: Number, min: 1, max: 10, default: 1 },
      allowSkip: { type: Boolean, default: false },
      allowRecordingReview: { type: Boolean, default: true },
      requireAudio: { type: Boolean, default: true },
      requireVideo: { type: Boolean, default: true },
      showScoreToCandidate: { type: Boolean, default: true },
      monitorTabAndFocus: { type: Boolean, default: true },
      monitorInactivity: { type: Boolean, default: true },
      webcamMonitoring: { type: Boolean, default: true },
      invitationStatus: {
        type: String,
        enum: ['not_created', 'created', 'sent', 'opened', 'activated', 'expired', 'revoked'],
        default: 'not_created',
      },
      invitationSentAt: { type: Date, default: null },
      activatedAt: { type: Date, default: null },
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    questionSetTitle: { type: String, default: '', maxlength: 200 },
    questionGeneration: {
      category: { type: String, default: 'mixed' },
      difficulty: { type: String, default: 'intermediate' },
      count: { type: Number, default: 0 },
      provider: { type: String, default: '' },
      model: { type: String, default: '' },
      responseId: { type: String, default: '' },
      generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      generatedAt: { type: Date, default: null },
    },
    questions: { type: [questionSchema], default: [] },
    questionSourceInterview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      default: null,
      index: true,
    },
    questionsCopiedAt: { type: Date, default: null },
    questionsCopiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    finalFeedback: { type: finalFeedbackSchema, default: () => ({}) },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

interviewSchema.index({ organization: 1, deliveryMode: 1, status: 1 });
interviewSchema.index({ organization: 1, scheduledAt: 1 });
interviewSchema.index({ candidate: 1, status: 1 });

export const Interview = mongoose.model('Interview', interviewSchema);
