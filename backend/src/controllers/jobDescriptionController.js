import { JobDescription } from '../models/JobDescription.js';
import { WebsiteApplication } from '../models/WebsiteApplication.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { queueWebsiteApplicationAutoScreening } from '../services/websiteApplicationAutoScreeningService.js';

function requireOrganization(user) {
  if (!user.organization) {
    throw new AppError('Your account is not assigned to an organization', 400);
  }
  return user.organization;
}

function serialize(jobDescription) {
  return {
    id: jobDescription._id.toString(),
    title: jobDescription.title,
    department: jobDescription.department || '',
    location: jobDescription.location || '',
    employmentType: jobDescription.employmentType || '',
    experienceLevel: jobDescription.experienceLevel || '',
    description: jobDescription.description,
    status: jobDescription.status,
    externalSource: jobDescription.externalSource || '',
    externalJobId: jobDescription.externalJobId || '',
    externalJobTitle: jobDescription.externalJobTitle || '',
    externalJobUrl: jobDescription.externalJobUrl || '',
    acceptWebsiteApplications: Boolean(jobDescription.acceptWebsiteApplications),
    createdBy: jobDescription.createdBy,
    updatedBy: jobDescription.updatedBy,
    createdAt: jobDescription.createdAt,
    updatedAt: jobDescription.updatedAt,
  };
}

function getCommonKeywords(jobDescriptions) {
  const stopWords = new Set([
    'and', 'the', 'with', 'for', 'from', 'that', 'this', 'will', 'your', 'you', 'our',
    'are', 'have', 'has', 'job', 'role', 'work', 'working', 'experience', 'years', 'skills',
    'strong', 'good', 'required', 'preferred', 'responsibilities', 'requirements', 'candidate',
  ]);

  const keywordSets = jobDescriptions.map((jd) => {
    const words = `${jd.title} ${jd.description}`
      .toLowerCase()
      .match(/[a-z][a-z0-9+#.-]{2,}/g) || [];
    return new Set(words.filter((word) => !stopWords.has(word)));
  });

  if (!keywordSets.length) return [];
  return [...keywordSets[0]]
    .filter((word) => keywordSets.every((set) => set.has(word)))
    .slice(0, 30);
}

export const listJobDescriptions = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);
  const filter = { organization };

  if (req.query.status && req.query.status !== 'all') {
    filter.status = req.query.status;
  }

  if (req.query.search) {
    const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { department: { $regex: escaped, $options: 'i' } },
      { location: { $regex: escaped, $options: 'i' } },
    ];
  }

  const jobDescriptions = await JobDescription.find(filter)
    .sort({ status: 1, updatedAt: -1 })
    .lean();

  res.json({
    success: true,
    jobDescriptions: jobDescriptions.map(serialize),
  });
});

export const getJobDescription = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);
  const jobDescription = await JobDescription.findOne({
    _id: req.params.jobDescriptionId,
    organization,
  });

  if (!jobDescription) throw new AppError('Job description not found', 404);

  res.json({ success: true, jobDescription: serialize(jobDescription) });
});

export const createJobDescription = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);

  const jobDescription = await JobDescription.create({
    ...req.body,
    organization,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: 'Job description created',
    jobDescription: serialize(jobDescription),
  });
});

export const updateJobDescription = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);

  const jobDescription = await JobDescription.findOne({
    _id: req.params.jobDescriptionId,
    organization,
  });

  if (!jobDescription) throw new AppError('Job description not found', 404);

  Object.assign(jobDescription, req.body, { updatedBy: req.user._id });
  await jobDescription.save();

  res.json({
    success: true,
    message: 'Job description updated',
    jobDescription: serialize(jobDescription),
  });
});

export const archiveJobDescription = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);

  const jobDescription = await JobDescription.findOne({
    _id: req.params.jobDescriptionId,
    organization,
  });

  if (!jobDescription) throw new AppError('Job description not found', 404);

  jobDescription.status = 'archived';
  jobDescription.updatedBy = req.user._id;
  jobDescription.acceptWebsiteApplications = false;
  await jobDescription.save();

  res.json({
    success: true,
    message: 'Job description archived',
    jobDescription: serialize(jobDescription),
  });
});

export const compareJobDescriptions = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);
  const requestedIds = req.body.jobDescriptionIds;

  const found = await JobDescription.find({
    _id: { $in: requestedIds },
    organization,
  }).lean();

  if (found.length !== requestedIds.length) {
    throw new AppError('One or more job descriptions were not found', 404);
  }

  const byId = new Map(found.map((jd) => [jd._id.toString(), jd]));
  const ordered = requestedIds.map((id) => byId.get(id));

  res.json({
    success: true,
    comparison: {
      jobDescriptions: ordered.map(serialize),
      commonKeywords: getCommonKeywords(ordered),
    },
  });
});

// Returns WordPress jobs discovered from actual website applications.
// This gives the later mapping UI a clean source without requiring WordPress API access.
export const listWordPressJobs = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);

  const discovered = await WebsiteApplication.aggregate([
    { $match: { organization } },
    {
      $group: {
        _id: '$externalJobId',
        externalJobTitle: { $last: '$jobTitle' },
        externalJobUrl: { $last: '$jobUrl' },
        applicationCount: { $sum: 1 },
        latestApplicationAt: { $max: { $ifNull: ['$appliedAt', '$receivedAt'] } },
      },
    },
    { $sort: { latestApplicationAt: -1, externalJobTitle: 1 } },
  ]);

  const mappings = await JobDescription.find({
    organization,
    externalSource: 'wordpress',
    externalJobId: { $in: discovered.map((item) => item._id) },
  })
    .select('_id title status externalJobId externalJobTitle externalJobUrl acceptWebsiteApplications')
    .lean();

  const mappingByExternalId = new Map(
    mappings.map((jd) => [jd.externalJobId, jd]),
  );

  res.json({
    success: true,
    wordpressJobs: discovered.map((item) => {
      const mapped = mappingByExternalId.get(item._id);
      return {
        externalJobId: item._id,
        externalJobTitle: item.externalJobTitle || '',
        externalJobUrl: item.externalJobUrl || '',
        applicationCount: item.applicationCount,
        latestApplicationAt: item.latestApplicationAt,
        mappingStatus: mapped ? 'mapped' : 'mapping_required',
        jobDescription: mapped
          ? {
              id: mapped._id.toString(),
              title: mapped.title,
              status: mapped.status,
              acceptWebsiteApplications: Boolean(mapped.acceptWebsiteApplications),
            }
          : null,
      };
    }),
  });
});

export const setWordPressMapping = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);

  const jobDescription = await JobDescription.findOne({
    _id: req.params.jobDescriptionId,
    organization,
  });

  if (!jobDescription) throw new AppError('Job description not found', 404);

  const {
    externalJobId,
    externalJobTitle = '',
    externalJobUrl = '',
    acceptWebsiteApplications = true,
  } = req.body;

  jobDescription.externalSource = 'wordpress';
  jobDescription.externalJobId = externalJobId;
  jobDescription.externalJobTitle = externalJobTitle || jobDescription.title;
  jobDescription.externalJobUrl = externalJobUrl;
  jobDescription.acceptWebsiteApplications = acceptWebsiteApplications;
  jobDescription.updatedBy = req.user._id;

  try {
    await jobDescription.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(
        'This WordPress Job ID is already mapped to another TalentLens job description.',
        409,
        { code: 'WORDPRESS_JOB_ALREADY_MAPPED' },
      );
    }
    throw error;
  }

  // Retroactively connect applications that arrived before mapping existed.
  const updateResult = await WebsiteApplication.updateMany(
    {
      organization,
      externalJobId,
      $or: [
        { jobDescription: null },
        { mappingStatus: 'mapping_required' },
      ],
    },
    {
      $set: {
        jobDescription: jobDescription._id,
        mappingStatus: 'mapped',
        status: 'ready_for_review',
        lastError: '',
      },
    },
  );

  // Only newly received applications explicitly marked eligible are auto-screened.
  // Historical applications mapped by this action remain untouched.
  const newlyEligible = await WebsiteApplication.find({
    organization,
    externalJobId,
    jobDescription: jobDescription._id,
    autoScreenEligible: true,
    status: 'ready_for_review',
  }).select('_id');

  for (const application of newlyEligible) {
    queueWebsiteApplicationAutoScreening({
      organization,
      applicationId: application._id,
      preferredActorId: req.user._id,
    });
  }

  res.json({
    success: true,
    message: 'WordPress job mapped to TalentLens job description.',
    jobDescription: serialize(jobDescription),
    applicationsMapped: updateResult.modifiedCount || 0,
  });
});

export const removeWordPressMapping = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);

  const jobDescription = await JobDescription.findOne({
    _id: req.params.jobDescriptionId,
    organization,
  });

  if (!jobDescription) throw new AppError('Job description not found', 404);

  jobDescription.externalSource = '';
  jobDescription.externalJobId = '';
  jobDescription.externalJobTitle = '';
  jobDescription.externalJobUrl = '';
  jobDescription.acceptWebsiteApplications = false;
  jobDescription.updatedBy = req.user._id;
  await jobDescription.save();

  // Existing applications keep their historical jobDescription link.
  // Removing a mapping only stops future applications from auto-mapping.

  res.json({
    success: true,
    message: 'WordPress mapping removed. Existing application history was preserved.',
    jobDescription: serialize(jobDescription),
  });
});
