import mongoose from 'mongoose';

const candidateAccountSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 320 },
    passwordHash: { type: String, required: true, select: false },
    candidates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' }],
    status: { type: String, enum: ['invited', 'active', 'locked', 'deactivated'], default: 'invited', index: true },
    mustChangePassword: { type: Boolean, default: true },
    emailVerifiedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    failedLoginAttempts: { type: Number, min: 0, default: 0 },
    lockedUntil: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    profile: {
      fullName: { type: String, trim: true, maxlength: 160, default: '' },
      phone: { type: String, trim: true, maxlength: 40, default: '' },
      alternatePhone: { type: String, trim: true, maxlength: 40, default: '' },
      currentCompany: { type: String, trim: true, maxlength: 160, default: '' },
      currentRole: { type: String, trim: true, maxlength: 160, default: '' },
      experienceYears: { type: Number, min: 0, max: 60, default: 0 },
      education: { type: String, trim: true, maxlength: 1000, default: '' },
      skills: [{ type: String, trim: true, maxlength: 100 }],
      address: {
        line1: { type: String, trim: true, maxlength: 240, default: '' },
        city: { type: String, trim: true, maxlength: 100, default: '' },
        state: { type: String, trim: true, maxlength: 100, default: '' },
        country: { type: String, trim: true, maxlength: 100, default: '' },
        postalCode: { type: String, trim: true, maxlength: 30, default: '' },
      },
      timezone: { type: String, trim: true, maxlength: 100, default: 'Asia/Kolkata' },
      language: { type: String, trim: true, maxlength: 20, default: 'en' },
    },
  },
  { timestamps: true },
);

candidateAccountSchema.index({ organization: 1, email: 1 }, { unique: true });
candidateAccountSchema.index({ organization: 1, status: 1 });

export const CandidateAccount = mongoose.model('CandidateAccount', candidateAccountSchema);
