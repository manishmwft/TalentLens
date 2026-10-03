import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  line1: { type: String, trim: true, maxlength: 180, default: '' },
  line2: { type: String, trim: true, maxlength: 180, default: '' },
  city: { type: String, trim: true, maxlength: 80, default: '' },
  state: { type: String, trim: true, maxlength: 80, default: '' },
  country: { type: String, trim: true, maxlength: 80, default: '' },
  postalCode: { type: String, trim: true, maxlength: 20, default: '' },
}, { _id: false });

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    legalName: { type: String, trim: true, maxlength: 160, default: '' },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    industry: { type: String, trim: true, maxlength: 100, default: '' },
    companySize: { type: String, trim: true, maxlength: 50, default: '' },
    foundedYear: { type: Number, min: 1800, max: 2200, default: null },
    website: { type: String, trim: true, maxlength: 300, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    taxId: { type: String, trim: true, maxlength: 80, default: '' },
    registrationNumber: { type: String, trim: true, maxlength: 80, default: '' },
    description: { type: String, trim: true, maxlength: 2500, default: '' },
    logoUrl: { type: String, trim: true, maxlength: 500, default: '' },
    brandColor: { type: String, trim: true, maxlength: 20, default: '#6366F1' },
    linkedinUrl: { type: String, trim: true, maxlength: 300, default: '' },
    twitterUrl: { type: String, trim: true, maxlength: 300, default: '' },
    address: { type: addressSchema, default: () => ({}) },
    timezone: { type: String, trim: true, maxlength: 80, default: 'Asia/Kolkata' },
    dateFormat: { type: String, trim: true, maxlength: 30, default: 'DD/MM/YYYY' },
    currency: { type: String, trim: true, maxlength: 10, default: 'INR' },
    defaultHiringEmail: { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
    defaultInterviewDuration: { type: Number, min: 10, max: 480, default: 45 },
    workingDays: { type: [String], default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const Organization = mongoose.model('Organization', organizationSchema);
