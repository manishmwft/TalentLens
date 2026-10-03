import mongoose from 'mongoose';
import { INVITATION_TYPES } from '../constants/interview.js';

const invitationTokenSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    candidateAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateAccount',
      required: true,
      index: true,
    },
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(INVITATION_TYPES),
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    metadata: {
      recipientEmail: { type: String, trim: true, lowercase: true, default: '' },
      requestIp: { type: String, trim: true, default: '' },
      userAgent: { type: String, trim: true, maxlength: 1000, default: '' },
    },
  },
  { timestamps: true },
);

invitationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
invitationTokenSchema.index({ candidateAccount: 1, type: 1, usedAt: 1 });

export const InvitationToken = mongoose.model(
  'InvitationToken',
  invitationTokenSchema,
);
