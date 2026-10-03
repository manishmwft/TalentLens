import mongoose from 'mongoose';

const integrationCredentialSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['wordpress'],
      required: true,
      default: 'wordpress',
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      default: 'WordPress Careers',
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
      select: false,
    },
    tokenPrefix: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
    },
    tokenLastFour: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

integrationCredentialSchema.index({ organization: 1, provider: 1, isActive: 1 });

export const IntegrationCredential = mongoose.model(
  'IntegrationCredential',
  integrationCredentialSchema,
);
