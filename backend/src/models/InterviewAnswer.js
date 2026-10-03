import mongoose from 'mongoose';
import { INTERVIEW_ANSWER_STATUSES } from '../constants/interview.js';

const mediaSchema = new mongoose.Schema(
  {
    filePath: { type: String, trim: true, default: '' },
    storageKey: { type: String, trim: true, default: '' },
    storageProvider: { type: String, trim: true, default: 'local' },
    mimeType: { type: String, trim: true, maxlength: 150, default: '' },
    sizeBytes: { type: Number, min: 0, default: 0 },
    durationSeconds: { type: Number, min: 0, default: 0 },
    recordedAt: { type: Date, default: null },
    uploadedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    checksum: { type: String, trim: true, maxlength: 256, default: '' },
  },
  { _id: false },
);

const transcriptionSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    text: { type: String, maxlength: 30000, default: '' },
    provider: { type: String, trim: true, default: '' },
    model: { type: String, trim: true, default: '' },
    language: { type: String, trim: true, maxlength: 30, default: 'en' },
    confidence: { type: Number, min: 0, max: 1, default: null },
    error: { type: String, maxlength: 2000, default: '' },
    attempts: { type: Number, min: 0, default: 0 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: false },
);

const evaluationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    coverageScore: { type: Number, min: 0, max: 100, default: 0 },
    technicalCorrectness: { type: Number, min: 0, max: 100, default: 0 },
    communicationClarity: { type: Number, min: 0, max: 100, default: 0 },
    relevanceScore: { type: Number, min: 0, max: 100, default: 0 },
    suggestedScore: { type: Number, min: 0, max: 5, default: 0 },
    coveredPoints: [{ type: String, trim: true, maxlength: 500 }],
    missingPoints: [{ type: String, trim: true, maxlength: 500 }],
    strengths: [{ type: String, trim: true, maxlength: 500 }],
    concerns: [{ type: String, trim: true, maxlength: 500 }],
    feedback: { type: String, maxlength: 3000, default: '' },
    suggestedFollowUp: { type: String, maxlength: 1000, default: '' },
    provider: { type: String, trim: true, default: '' },
    model: { type: String, trim: true, default: '' },
    error: { type: String, maxlength: 2000, default: '' },
    attempts: { type: Number, min: 0, default: 0 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    evaluatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const interviewAnswerSchema = new mongoose.Schema(
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
    attempt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewAttempt',
      required: true,
      index: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
      index: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    questionSnapshot: {
      question: { type: String, required: true, maxlength: 1500 },
      category: { type: String, trim: true, default: '' },
      difficulty: { type: String, trim: true, default: '' },
      expectedPoints: [{ type: String, trim: true, maxlength: 500 }],
      evaluationGuidance: { type: String, maxlength: 2000, default: '' },
    },
    order: { type: Number, min: 0, default: 0 },
    submissionId: { type: String, trim: true, maxlength: 160, default: '', index: true },
    uploadError: { type: String, maxlength: 2000, default: '' },
    status: {
      type: String,
      enum: Object.values(INTERVIEW_ANSWER_STATUSES),
      default: INTERVIEW_ANSWER_STATUSES.NOT_STARTED,
      index: true,
    },
    audio: { type: mediaSchema, default: () => ({}) },
    video: { type: mediaSchema, default: () => ({}) },
    transcription: { type: transcriptionSchema, default: () => ({}) },
    evaluation: { type: evaluationSchema, default: () => ({}) },
    retryCount: { type: Number, min: 0, default: 0 },
    maxRetries: { type: Number, min: 0, max: 10, default: 1 },
    timer: {
      allowedSeconds: { type: Number, min: 0, default: 180 },
      startedAt: { type: Date, default: null },
      stoppedAt: { type: Date, default: null },
      elapsedSeconds: { type: Number, min: 0, default: 0 },
      expired: { type: Boolean, default: false },
    },
    submittedAt: { type: Date, default: null },
    failureReason: { type: String, maxlength: 2000, default: '' },
  },
  { timestamps: true },
);

interviewAnswerSchema.index(
  { attempt: 1, questionId: 1 },
  { unique: true },
);
interviewAnswerSchema.index({ organization: 1, status: 1, createdAt: -1 });
interviewAnswerSchema.index({ interview: 1, order: 1 });
interviewAnswerSchema.index({ attempt: 1, questionId: 1, submissionId: 1 });

export const InterviewAnswer = mongoose.model(
  'InterviewAnswer',
  interviewAnswerSchema,
);
