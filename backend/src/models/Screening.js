import mongoose from 'mongoose';

const screeningSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jobDescriptionRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobDescription',
      default: null,
      index: true,
    },
    jobDescriptionTitle: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    jobDescription: {
      type: String,
      required: true,
      trim: true,
      minlength: 30,
    },
    source: {
      type: String,
      enum: ['manual', 'website'],
      default: 'manual',
      index: true,
    },
    totalCandidates: { type: Number, default: 0, min: 0 },
    parsedCandidates: { type: Number, default: 0, min: 0 },
    failedCandidates: { type: Number, default: 0, min: 0 },
    analyzedCandidates: { type: Number, default: 0, min: 0 },
    failedAnalysisCandidates: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['processing', 'completed', 'partially_completed', 'failed'],
      default: 'processing',
    },
    analysisStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'partially_completed', 'failed'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true },
);

// A website-originated JD gets one reusable screening container. This keeps
// all applicants for the same WordPress job grouped under the same JD.
screeningSchema.index(
  { organization: 1, jobDescriptionRef: 1, source: 1 },
  {
    unique: true,
    partialFilterExpression: { source: 'website' },
  },
);

export const Screening = mongoose.model('Screening', screeningSchema);
