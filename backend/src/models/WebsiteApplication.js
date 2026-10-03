import mongoose from 'mongoose';

const websiteApplicationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    integrationCredential: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IntegrationCredential',
      default: null,
      index: true,
    },

    // A website application may arrive before the corresponding WordPress
    // job has been mapped to a TalentLens JD. Therefore this is nullable.
    jobDescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobDescription',
      default: null,
      index: true,
    },

    // These remain null until the recruiter explicitly chooses to screen
    // the applicant in a later build.
    screening: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Screening',
      default: null,
      index: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      default: null,
      index: true,
    },

    source: {
      type: String,
      enum: ['mushroom_world_group_website'],
      default: 'mushroom_world_group_website',
      index: true,
    },
    externalApplicationId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    externalJobId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    jobTitle: { type: String, required: true, trim: true, maxlength: 160 },
    jobUrl: { type: String, default: '', trim: true, maxlength: 1000 },
    // Snapshot of the WordPress JD sent with the application. This lets
    // TalentLens create/map a JD automatically without making WordPress
    // the long-term source of truth for future screening edits.
    externalJobDescription: {
      type: String,
      default: '',
      maxlength: 30000,
    },
    fullName: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 320 },
    phone: { type: String, default: '', trim: true, maxlength: 80 },
    coverLetter: { type: String, default: '', trim: true, maxlength: 10000 },

    resumeOriginalName: { type: String, required: true, trim: true },
    resumeStoredName: { type: String, required: true, trim: true },
    resumePath: { type: String, required: true },
    resumeFileType: { type: String, enum: ['pdf', 'docx'], required: true },
    resumeFileSize: { type: Number, required: true, min: 1 },

    idempotencyKey: { type: String, required: true, trim: true, maxlength: 240 },

    mappingStatus: {
      type: String,
      enum: ['mapped', 'mapping_required'],
      default: 'mapping_required',
      index: true,
    },

    status: {
      type: String,
      enum: [
        'received',
        'jd_mapping_required',
        'ready_for_review',
        'selected_for_screening',
        'screening',
        'analyzed',
        'archived',
        'failed',
      ],
      default: 'received',
      index: true,
    },

    // Kept for compatibility with the later screening/AI stage.
    parsingStatus: {
      type: String,
      enum: ['pending', 'parsed', 'failed'],
      default: 'pending',
    },
    analysisStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },

    // Only applications received after automatic screening was deployed are eligible.
    // Existing/historical applications keep the default false and are never bulk-screened.
    autoScreenEligible: { type: Boolean, default: false, index: true },
    autoScreenStartedAt: { type: Date, default: null },
    autoScreenCompletedAt: { type: Date, default: null },

    lastError: { type: String, default: '', maxlength: 2000 },
    appliedAt: { type: Date, default: null, index: true },
    receivedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

websiteApplicationSchema.index(
  { organization: 1, source: 1, externalApplicationId: 1 },
  { unique: true },
);
websiteApplicationSchema.index(
  { organization: 1, idempotencyKey: 1 },
  { unique: true },
);
websiteApplicationSchema.index({ organization: 1, appliedAt: -1 });
websiteApplicationSchema.index({ organization: 1, externalJobId: 1, appliedAt: -1 });
websiteApplicationSchema.index({ organization: 1, mappingStatus: 1, status: 1 });

export const WebsiteApplication = mongoose.model(
  'WebsiteApplication',
  websiteApplicationSchema,
);
