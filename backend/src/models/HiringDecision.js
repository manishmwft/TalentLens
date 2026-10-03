import mongoose from 'mongoose';

const hiringDecisionSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    screening: { type: mongoose.Schema.Types.ObjectId, ref: 'Screening', required: true, index: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
    interview: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', default: null },
    decision: {
      type: String,
      enum: ['move_forward', 'hold', 'reject', 'offer', 'hired'],
      required: true,
      index: true,
    },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    notes: { type: String, default: '', trim: true, maxlength: 5000 },
    previousWorkflowStatus: { type: String, default: '', trim: true },
    resultingWorkflowStatus: { type: String, default: '', trim: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decidedByName: { type: String, required: true, trim: true, maxlength: 120 },
    decidedByRole: { type: String, required: true, trim: true, maxlength: 80 },
    decidedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

hiringDecisionSchema.index({ candidate: 1, decidedAt: -1 });
hiringDecisionSchema.index({ organization: 1, decision: 1, decidedAt: -1 });

export const HiringDecision = mongoose.model('HiringDecision', hiringDecisionSchema);
