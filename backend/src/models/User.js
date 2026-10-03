import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLE_VALUES, ROLES } from '../constants/roles.js';

const addressSchema = new mongoose.Schema({
  line1: { type: String, trim: true, maxlength: 180, default: '' },
  line2: { type: String, trim: true, maxlength: 180, default: '' },
  city: { type: String, trim: true, maxlength: 80, default: '' },
  state: { type: String, trim: true, maxlength: 80, default: '' },
  country: { type: String, trim: true, maxlength: 80, default: '' },
  postalCode: { type: String, trim: true, maxlength: 20, default: '' },
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, minlength: 8, select: false },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    role: { type: String, enum: ROLE_VALUES, default: ROLES.RECRUITER, index: true },
    isActive: { type: Boolean, default: true, index: true },
    mustChangePassword: { type: Boolean, default: false },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    invitationSentAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    avatarUrl: { type: String, trim: true, maxlength: 500, default: '' },
    employeeId: { type: String, trim: true, maxlength: 60, default: '' },
    department: { type: String, trim: true, maxlength: 100, default: '' },
    designation: { type: String, trim: true, maxlength: 100, default: '' },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    alternatePhone: { type: String, trim: true, maxlength: 40, default: '' },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, trim: true, maxlength: 40, default: '' },
    bio: { type: String, trim: true, maxlength: 1500, default: '' },
    skills: { type: [String], default: [] },
    linkedinUrl: { type: String, trim: true, maxlength: 300, default: '' },
    githubUrl: { type: String, trim: true, maxlength: 300, default: '' },
    timezone: { type: String, trim: true, maxlength: 80, default: 'Asia/Kolkata' },
    language: { type: String, trim: true, maxlength: 60, default: 'English' },
    address: { type: addressSchema, default: () => ({}) },
    emergencyContact: {
      name: { type: String, trim: true, maxlength: 100, default: '' },
      relationship: { type: String, trim: true, maxlength: 60, default: '' },
      phone: { type: String, trim: true, maxlength: 40, default: '' },
    },
  },
  { timestamps: true },
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const organization = this.organization && typeof this.organization === 'object'
    ? { id: this.organization._id?.toString?.() || this.organization.id, name: this.organization.name, slug: this.organization.slug }
    : this.organization ? { id: this.organization.toString() } : null;

  return {
    id: this._id.toString(), name: this.name, email: this.email, role: this.role,
    isActive: this.isActive, mustChangePassword: this.mustChangePassword, organization,
    avatarUrl: this.avatarUrl, employeeId: this.employeeId, department: this.department,
    designation: this.designation, phone: this.phone, alternatePhone: this.alternatePhone,
    dateOfBirth: this.dateOfBirth, gender: this.gender, bio: this.bio, skills: this.skills || [],
    linkedinUrl: this.linkedinUrl, githubUrl: this.githubUrl, timezone: this.timezone,
    language: this.language, address: this.address || {}, emergencyContact: this.emergencyContact || {},
    createdAt: this.createdAt, updatedAt: this.updatedAt,
    invitationSentAt: this.invitationSentAt, lastLoginAt: this.lastLoginAt,
  };
};

export const User = mongoose.model('User', userSchema);
