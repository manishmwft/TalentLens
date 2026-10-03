import mongoose from 'mongoose';
import { INTERVIEW_ATTEMPT_STATUSES } from '../constants/interview.js';

const integrityEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'tab_hidden',
        'window_blur',
        'window_focus',
        'inactivity',
        'camera_disabled',
        'microphone_disabled',
        'no_face',
        'multiple_faces',
        'network_disconnected',
        'network_reconnected',
        'multiple_login',
      ],
      required: true,
    },
    occurredAt: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: true },
);

const interviewAttemptSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
      index: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
      index: true,
    },
    candidateAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateAccount',
      required: true,
      index: true,
    },
    attemptNumber: { type: Number, min: 1, default: 1 },
    maxAttempts: { type: Number, min: 1, max: 10, default: 1 },
    status: {
      type: String,
      enum: Object.values(INTERVIEW_ATTEMPT_STATUSES),
      default: INTERVIEW_ATTEMPT_STATUSES.DRAFT,
      index: true,
    },
    currentQuestionIndex: { type: Number, min: 0, default: 0 },
    completedQuestionIds: [{ type: mongoose.Schema.Types.ObjectId }],
    consent: {
      accepted: { type: Boolean, default: false },
      recordingAccepted: { type: Boolean, default: false },
      aiEvaluationAccepted: { type: Boolean, default: false },
      monitoringAccepted: { type: Boolean, default: false },
      privacyAccepted: { type: Boolean, default: false },
      acceptedAt: { type: Date, default: null },
      version: { type: String, trim: true, maxlength: 50, default: '' },
      ipAddress: { type: String, trim: true, maxlength: 100, default: '' },
      userAgent: { type: String, trim: true, maxlength: 1000, default: '' },
    },
    deviceCheck: {
      completedAt: { type: Date, default: null },
      microphonePassed: { type: Boolean, default: false },
      cameraPassed: { type: Boolean, default: false },
      speakerPassed: { type: Boolean, default: false },
      browserSupported: { type: Boolean, default: false },
      connectionPassed: { type: Boolean, default: false },
      metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    session: {
      startedAt: { type: Date, default: null },
      lastSavedAt: { type: Date, default: null },
      submittedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null, index: true },
      lastActivityAt: { type: Date, default: null },
    },
    integrityEvents: { type: [integrityEventSchema], default: [] },
    finalEvaluation: {
      status: {
        type: String,
        enum: ['pending', 'ready_for_review', 'reviewed', 'failed'],
        default: 'pending',
        index: true,
      },
      overallScore: { type: Number, min: 0, max: 100, default: 0 },
      technicalScore: { type: Number, min: 0, max: 100, default: 0 },
      coverageScore: { type: Number, min: 0, max: 100, default: 0 },
      communicationScore: { type: Number, min: 0, max: 100, default: 0 },
      relevanceScore: { type: Number, min: 0, max: 100, default: 0 },
      problemSolvingScore: { type: Number, min: 0, max: 100, default: 0 },
      roleFitScore: { type: Number, min: 0, max: 100, default: 0 },
      resumeAlignmentScore: { type: Number, min: 0, max: 100, default: 0 },
      recommendation: {
        type: String,
        enum: ['', 'strong_hire', 'hire', 'hold', 'no_hire'],
        default: '',
      },
      strengths: [{ type: String, trim: true, maxlength: 500 }],
      concerns: [{ type: String, trim: true, maxlength: 500 }],
      summary: { type: String, maxlength: 5000, default: '' },
      provider: { type: String, trim: true, default: '' },
      model: { type: String, trim: true, default: '' },
      answerCount: { type: Number, min: 0, default: 0 },
      evaluatedAnswerCount: { type: Number, min: 0, default: 0 },
      weights: {
        technical: { type: Number, min: 0, max: 1, default: 0.35 },
        coverage: { type: Number, min: 0, max: 1, default: 0.25 },
        communication: { type: Number, min: 0, max: 1, default: 0.15 },
        relevance: { type: Number, min: 0, max: 1, default: 0.15 },
        resumeAlignment: { type: Number, min: 0, max: 1, default: 0.1 },
      },
      integritySummary: {
        totalEvents: { type: Number, min: 0, default: 0 },
        counts: { type: mongoose.Schema.Types.Mixed, default: {} },
        riskScore: { type: Number, min: 0, max: 100, default: 0 },
        riskLevel: {
          type: String,
          enum: ['low', 'moderate', 'high'],
          default: 'low',
        },
        requiresAttention: { type: Boolean, default: false },
      },
      staffReview: {
        status: {
          type: String,
          enum: ['pending', 'approved'],
          default: 'pending',
        },
        notes: { type: String, maxlength: 5000, default: '' },
        adjustedOverallScore: { type: Number, min: 0, max: 100, default: null },
        adjustedRecommendation: {
          type: String,
          enum: ['', 'strong_hire', 'hire', 'hold', 'no_hire'],
          default: '',
        },
        reviewedAt: { type: Date, default: null },
        reviewedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
      },
      evaluatedAt: { type: Date, default: null },
      staffReviewedAt: { type: Date, default: null },
      staffReviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },
    failureReason: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { timestamps: true },
);

interviewAttemptSchema.index({ interview: 1, attemptNumber: 1 }, { unique: true });
interviewAttemptSchema.index({ organization: 1, status: 1, createdAt: -1 });
interviewAttemptSchema.index({ candidateAccount: 1, status: 1 });

export const InterviewAttempt = mongoose.model('InterviewAttempt', interviewAttemptSchema);
