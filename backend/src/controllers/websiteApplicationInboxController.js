import fs from 'fs';
import path from 'path';
import { WebsiteApplication } from '../models/WebsiteApplication.js';
import { Candidate } from '../models/Candidate.js';
import { Screening } from '../models/Screening.js';
import { promoteWebsiteApplications } from '../services/websiteApplicationPromotionService.js';
import { processPromotedWebsiteApplications } from '../services/websiteApplicationProcessingService.js';
import { autoMapPendingWordPressApplications } from '../services/wordpressJobAutoMappingService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function requireOrganization(user) {
  if (!user.organization) {
    throw new AppError('Your account is not assigned to an organization', 400);
  }
  return user.organization;
}

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serialize(application, { detail = false } = {}) {
  const jd = application.jobDescription;
  const payload = {
    id: application._id.toString(),
    externalApplicationId: application.externalApplicationId,
    externalJobId: application.externalJobId,
    jobTitle: application.jobTitle,
    jobUrl: application.jobUrl || '',
    fullName: application.fullName,
    email: application.email,
    phone: application.phone || '',
    source: application.source,
    status: application.status,
    mappingStatus: application.mappingStatus,
    appliedAt: application.appliedAt,
    receivedAt: application.receivedAt,
    resume: {
      filename: application.resumeOriginalName,
      fileType: application.resumeFileType,
      fileSize: application.resumeFileSize,
    },
    jobDescription: jd
      ? {
          id: jd._id.toString(),
          title: jd.title,
          department: jd.department || '',
          status: jd.status,
        }
      : null,
    candidateId: application.candidate
      ? application.candidate._id?.toString?.() || application.candidate.toString()
      : null,
    screeningId: application.screening
      ? application.screening._id?.toString?.() || application.screening.toString()
      : null,
    analysis: application.candidate?.analysis
      ? {
          matchScore: application.candidate.analysis.matchScore ?? null,
          recommendation: application.candidate.analysis.recommendation || '',
          currentRole: application.candidate.analysis.currentRole || '',
        }
      : null,
    processing: {
      resumeParsing: application.parsingStatus,
      aiAnalysis: application.analysisStatus,
    },
  };

  if (detail) {
    payload.coverLetter = application.coverLetter || '';
    payload.lastError = application.lastError || '';
    payload.createdAt = application.createdAt;
    payload.updatedAt = application.updatedAt;
  }

  return payload;
}

export const autoMapWebsiteApplications = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);
  const result = await autoMapPendingWordPressApplications({ organization });

  res.json({
    success: true,
    message:
      result.applicationsMapped > 0
        ? `${result.applicationsMapped} website application(s) automatically mapped to TalentLens job descriptions.`
        : 'No additional website applications could be auto-mapped.',
    data: result,
  });
});

export const listWebsiteApplications = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);
  const { page, limit, search, status, mappingStatus, externalJobId, jobDescriptionId, fromDate, toDate, scoreBand } = req.query;

  const filter = { organization };
  if (status !== 'all') filter.status = status;
  if (mappingStatus !== 'all') filter.mappingStatus = mappingStatus;
  if (externalJobId) filter.externalJobId = externalJobId;
  if (jobDescriptionId) filter.jobDescription = jobDescriptionId;

  if (fromDate || toDate) {
    filter.appliedAt = {};
    if (fromDate) filter.appliedAt.$gte = new Date(`${fromDate}T00:00:00.000Z`);
    if (toDate) filter.appliedAt.$lte = new Date(`${toDate}T23:59:59.999Z`);
  }

  if (search) {
    const regex = new RegExp(escapeRegExp(search), 'i');
    filter.$or = [
      { fullName: regex },
      { email: regex },
      { phone: regex },
      { jobTitle: regex },
      { externalApplicationId: regex },
      { externalJobId: regex },
    ];
  }

  if (scoreBand !== 'all') {
    const ranges = {
      '80_100': [80, 100],
      '60_79': [60, 79.999],
      '40_59': [40, 59.999],
      '0_39': [0, 39.999],
    };
    const [min, max] = ranges[scoreBand];
    const matchingCandidates = await Candidate.find({
      'analysis.matchScore': { $gte: min, $lte: max },
    }).select('_id').lean();
    filter.candidate = { $in: matchingCandidates.map((item) => item._id) };
  }

  const skip = (page - 1) * limit;
  const [applications, total, summaryRows, jobs] = await Promise.all([
    WebsiteApplication.find(filter)
      .populate('jobDescription', 'title department status')
      .populate('candidate', 'analysis analysisStatus')
      .sort({ appliedAt: -1, receivedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    WebsiteApplication.countDocuments(filter),
    WebsiteApplication.aggregate([
      { $match: { organization } },
      {
        $lookup: {
          from: 'candidates',
          localField: 'candidate',
          foreignField: '_id',
          as: 'candidateSummary',
        },
      },
      {
        $unwind: {
          path: '$candidateSummary',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          mappingRequired: {
            $sum: { $cond: [{ $eq: ['$mappingStatus', 'mapping_required'] }, 1, 0] },
          },
          readyForReview: {
            $sum: { $cond: [{ $eq: ['$status', 'ready_for_review'] }, 1, 0] },
          },
          selectedForScreening: {
            $sum: { $cond: [{ $eq: ['$status', 'selected_for_screening'] }, 1, 0] },
          },
          autoScreening: {
            $sum: { $cond: [{ $and: [{ $eq: ['$autoScreenEligible', true] }, { $in: ['$status', ['selected_for_screening', 'screening']] }] }, 1, 0] },
          },
          archived: {
            $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] },
          },
          analyzed: {
            $sum: { $cond: [{ $eq: ['$status', 'analyzed'] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
          },
          analyzedScoreTotal: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'analyzed'] },
                    { $ne: ['$candidateSummary.analysis.matchScore', null] },
                  ],
                },
                '$candidateSummary.analysis.matchScore',
                0,
              ],
            },
          },
          analyzedScoreCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'analyzed'] },
                    { $ne: ['$candidateSummary.analysis.matchScore', null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    WebsiteApplication.aggregate([
      { $match: { organization } },
      {
        $group: {
          _id: '$externalJobId',
          title: { $last: '$jobTitle' },
          count: { $sum: 1 },
        },
      },
      { $sort: { title: 1 } },
    ]),
  ]);

  const summary = summaryRows[0] || {
    total: 0,
    mappingRequired: 0,
    readyForReview: 0,
    selectedForScreening: 0,
    autoScreening: 0,
    archived: 0,
    analyzed: 0,
    failed: 0,
    analyzedScoreTotal: 0,
    analyzedScoreCount: 0,
  };

  summary.averageAiScore = summary.analyzedScoreCount
    ? Math.round(summary.analyzedScoreTotal / summary.analyzedScoreCount)
    : 0;

  delete summary.analyzedScoreTotal;
  delete summary.analyzedScoreCount;

  res.json({
    success: true,
    applications: applications.map((item) => serialize(item)),
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
    summary,
    jobs: jobs.map((job) => ({
      externalJobId: job._id,
      title: job.title || `WordPress Job ${job._id}`,
      applicationCount: job.count,
    })),
  });
});

export const getWebsiteApplication = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);
  const application = await WebsiteApplication.findOne({
    _id: req.params.applicationId,
    organization,
  }).populate('jobDescription', 'title department location employmentType experienceLevel description status')
    .populate('candidate', 'analysis analysisStatus');

  if (!application) throw new AppError('Website application not found', 404);

  res.json({
    success: true,
    application: serialize(application, { detail: true }),
  });
});

export const downloadWebsiteApplicationResume = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);
  const application = await WebsiteApplication.findOne({
    _id: req.params.applicationId,
    organization,
  }).select('resumePath resumeOriginalName');

  if (!application) throw new AppError('Website application not found', 404);

  // 01D: new applications store a public Vercel Blob URL in resumePath.
  // Keep the local-file branch for historical records created before Blob migration.
  if (/^https?:\/\//i.test(application.resumePath)) {
    return res.redirect(302, application.resumePath);
  }

  const absolutePath = path.resolve(application.resumePath);
  if (!fs.existsSync(absolutePath)) {
    throw new AppError('Resume file is no longer available on the server', 404, {
      code: 'RESUME_FILE_NOT_FOUND',
    });
  }

  return res.download(absolutePath, application.resumeOriginalName);
});

export const archiveWebsiteApplication = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);
  const application = await WebsiteApplication.findOne({
    _id: req.params.applicationId,
    organization,
  }).populate('jobDescription', 'title department status');

  if (!application) throw new AppError('Website application not found', 404);

  if (
    ['selected_for_screening', 'screening', 'analyzed'].includes(
      application.status,
    )
  ) {
    throw new AppError(
      'Applications already promoted to the screening workflow cannot be archived from the inbox.',
      409,
      { code: 'APPLICATION_ALREADY_SCREENED' },
    );
  }

  application.status = 'archived';
  await application.save();

  res.json({
    success: true,
    message: 'Website application archived.',
    application: serialize(application),
  });
});

export const screenSelectedWebsiteApplications = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);

  const promotion = await promoteWebsiteApplications({
    organization,
    recruiter: req.user,
    applicationIds: req.body.applicationIds,
  });

  // Part 5 completes the recruiter-triggered screening operation. Only
  // applications selected in this request are parsed and analyzed.
  const processing = await processPromotedWebsiteApplications({
    organization,
    actor: req.user,
    applicationIds: req.body.applicationIds,
  });

  const completed = processing.completedCount;
  const failed = processing.failedCount;

  res.json({
    success: true,
    message:
      failed === 0
        ? `${completed} selected application(s) screened successfully.`
        : `${completed} application(s) screened successfully and ${failed} failed. Failed applications remain saved for review.`,
    data: {
      promotedCount: promotion.promoted.length,
      alreadyPromotedCount: promotion.alreadyPromoted.length,
      promoted: promotion.promoted,
      alreadyPromoted: promotion.alreadyPromoted,
      screeningGroups: promotion.screeningGroups,
      processedCount: processing.results.length,
      completedCount: completed,
      failedCount: failed,
      results: processing.results,
      screeningSummaries: processing.screeningSummaries,
      nextStep: failed > 0 ? 'review_failed_applications' : 'screening_complete',
    },
  });
});


// Attach a missing screening to an existing failed application; do not start AI here.
export const recoverFailedWebsiteScreening = asyncHandler(async (req, res) => {
  const organization = requireOrganization(req.user);
  const application = await WebsiteApplication.findOne({
    _id: req.params.applicationId, organization,
  });
  if (!application) throw new AppError('Website application not found', 404);

  // Prefer the existing link, then check for an orphaned screening from an interrupted request.
  let screening = application.screening
    ? await Screening.findOne({ _id: application.screening, organization, source: 'website' })
    : null;
  if (!screening) {
    screening = await Screening.findOne({
      organization, source: 'website', websiteApplication: application._id,
    });
  }
  if (screening) {
    if (!application.screening || String(application.screening) !== String(screening._id)) {
      application.screening = screening._id;
      await application.save();
    }
    return res.json({ success: true, screeningId: String(screening._id) });
  }
  if (application.status !== 'failed') {
    throw new AppError('Only failed applications can recover a missing screening', 409);
  }
  if (!application.resumePath) {
    throw new AppError('Original resume is missing; restore it before retrying', 409);
  }
  const originalError = application.lastError || 'Automatic screening failed before a screening record was created.';
  const result = await promoteWebsiteApplications({
    organization, recruiter: req.user, applicationIds: [String(application._id)],
    allowFailedRecovery: true,
  });
  const item = [...result.promoted, ...result.alreadyPromoted][0];
  if (!item?.screeningId) throw new AppError('Screening recovery could not be completed', 500);

  // Preserve the original failure and make it visible on the existing Screening Result page.
  await Candidate.updateOne({ _id: item.candidateId, websiteApplication: application._id }, {
    $set: { parsingStatus: 'failed', parsingError: originalError,
      analysisStatus: 'failed', analysisError: originalError },
  });
  await Screening.updateOne({ _id: item.screeningId, organization, source: 'website' }, {
    $set: { status: 'failed', analysisStatus: 'failed', totalCandidates: 1,
      failedCandidates: 1, failedAnalysisCandidates: 1 },
  });
  await WebsiteApplication.updateOne({ _id: application._id, organization }, {
    $set: { status: 'failed', parsingStatus: 'failed', analysisStatus: 'failed', lastError: originalError },
  });
  return res.json({ success: true, screeningId: item.screeningId });
});
