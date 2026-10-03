import mongoose from 'mongoose';

const candidateEventSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    screening: { type: mongoose.Schema.Types.ObjectId, ref: 'Screening', required: true, index: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
    interview: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', default: null, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: 'System', trim: true, maxlength: 120 },
    actorRole: { type: String, default: 'system', trim: true, maxlength: 80 },
    type: {
      type: String,
      enum: [
        'resume_uploaded',
        'analysis_completed',
        'analysis_failed',
        'status_changed',
        'notes_updated',
        'interview_scheduled',
        'interview_started',
        'interview_completed',
        'interview_cancelled',
        'feedback_submitted',
        'decision_recorded',
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

candidateEventSchema.index({ candidate: 1, occurredAt: -1 });
candidateEventSchema.index({ organization: 1, occurredAt: -1 });

export const CandidateEvent = mongoose.model('CandidateEvent', candidateEventSchema);
