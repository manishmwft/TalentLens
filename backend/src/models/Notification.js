import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'candidate_invited',
        'interview_created',
        'interview_assigned',
        'interview_completed',
        'feedback_pending',
        'hiring_decision',
        'system',
      ],
      default: 'system',
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    link: { type: String, trim: true, maxlength: 500, default: '' },
    entityType: { type: String, trim: true, maxlength: 80, default: '' },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    readAt: { type: Date, default: null, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

notificationSchema.index({ organization: 1, recipient: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
