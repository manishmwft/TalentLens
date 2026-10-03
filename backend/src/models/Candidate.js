import mongoose from 'mongoose';

const analysisSchema = new mongoose.Schema(
  {
    candidateName: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    currentRole: { type: String, default: '' },
    totalExperienceYears: { type: Number, default: 0 },
    skills: { type: [String], default: [] },
    matchedSkills: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    concerns: { type: [String], default: [] },
    education: { type: [String], default: [] },
    matchScore: { type: Number, min: 0, max: 100, default: 0 },
    recommendation: {
      type: String,
      enum: [
        'strong_match',
        'good_match',
        'partial_match',
        'not_recommended',
      ],
      default: 'not_recommended',
    },
    summary: { type: String, default: '' },
  },
  { _id: false },
);

const candidateSchema = new mongoose.Schema(
  {
    screening: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Screening',
      required: true,
      index: true,
    },
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Populated only when the candidate originated from Website Applications.
    // The unique sparse index makes promotion idempotent: the same website
    // application can never create two Candidate records.
    websiteApplication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WebsiteApplication',
      default: null,
      index: true,
    },

    originalFileName: { type: String, required: true, trim: true },
    storedFileName: { type: String, required: true, trim: true },
    filePath: { type: String, required: true },
    fileType: { type: String, enum: ['pdf', 'docx'], required: true },
    fileSize: { type: Number, required: true },
    extractedText: { type: String, default: '' },
    parsingStatus: {
      type: String,
      enum: ['pending', 'parsed', 'failed'],
      default: 'pending',
    },
    parsingError: { type: String, default: '' },
    analysisStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    analysisError: { type: String, default: '' },
    analysis: { type: analysisSchema, default: undefined },
    analyzedAt: { type: Date, default: null },
    aiProvider: {
      type: String,
      enum: ['', 'gemini', 'openai', 'ollama', 'mock'],
      default: '',
    },
    aiModel: { type: String, default: '' },
    aiResponseId: { type: String, default: '' },
    workflowStatus: {
      type: String,
      enum: ['new', 'reviewing', 'shortlisted', 'interview', 'offer', 'rejected', 'hired'],
      default: 'new',
      index: true,
    },
    recruiterNotes: {
      type: String,
      default: '',
      maxlength: 5000,
    },
  },
  { timestamps: true },
);

candidateSchema.index({ screening: 1, 'analysis.matchScore': -1 });
candidateSchema.index(
  { websiteApplication: 1 },
  {
    unique: true,
    partialFilterExpression: {
      websiteApplication: { $type: 'objectId' },
    },
  },
);

export const Candidate = mongoose.model('Candidate', candidateSchema);
