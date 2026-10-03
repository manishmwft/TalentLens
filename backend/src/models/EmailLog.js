import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', default: null, index: true },
    candidateAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateAccount', default: null, index: true },
    interview: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', default: null, index: true },
    recipient: { type: String, required: true, trim: true, lowercase: true, maxlength: 320, index: true },
    template: { type: String, required: true, trim: true, maxlength: 100, index: true },
    provider: { type: String, required: true, trim: true, maxlength: 50, default: 'mock' },
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    status: { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued', index: true },
    providerMessageId: { type: String, trim: true, maxlength: 500, default: '' },
    error: { type: String, trim: true, maxlength: 3000, default: '' },
    sentAt: { type: Date, default: null },
    retryCount: { type: Number, min: 0, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

emailLogSchema.index({ organization: 1, createdAt: -1 });

export const EmailLog = mongoose.model('EmailLog', emailLogSchema);
