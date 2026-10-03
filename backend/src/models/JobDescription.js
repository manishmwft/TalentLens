import mongoose from 'mongoose';

const jobDescriptionSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
      index: true,
    },
    department: { type: String, trim: true, maxlength: 120, default: '' },
    location: { type: String, trim: true, maxlength: 160, default: '' },
    employmentType: { type: String, trim: true, maxlength: 80, default: '' },
    experienceLevel: { type: String, trim: true, maxlength: 100, default: '' },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 30,
      maxlength: 30000,
    },
    status: {
      type: String,
      enum: ['active', 'draft', 'archived'],
      default: 'active',
      index: true,
    },

    // External careers-site mapping.
    // externalJobId is the WP Job Openings WordPress job/post ID.
    externalSource: {
      type: String,
      enum: ['', 'wordpress'],
      default: '',
      trim: true,
      index: true,
    },
    externalJobId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    externalJobTitle: {
      type: String,
      default: '',
      trim: true,
      maxlength: 160,
    },
    externalJobUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    acceptWebsiteApplications: {
      type: Boolean,
      default: false,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

jobDescriptionSchema.index({ organization: 1, status: 1, title: 1 });
jobDescriptionSchema.index(
  { organization: 1, externalSource: 1, externalJobId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      externalSource: 'wordpress',
      externalJobId: { $type: 'string', $gt: '' },
    },
  },
);

export const JobDescription = mongoose.model('JobDescription', jobDescriptionSchema);
