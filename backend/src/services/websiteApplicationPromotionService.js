import { Candidate } from '../models/Candidate.js';
import { Screening } from '../models/Screening.js';
import { WebsiteApplication } from '../models/WebsiteApplication.js';
import { recordCandidateEvent } from './candidateTimelineService.js';
import { AppError } from '../utils/AppError.js';

async function getOrCreateWebsiteScreening({ organization, jobDescription, recruiter, application }) {
  // Website applications are intentionally isolated: one application = one
  // screening. Reuse only the screening already assigned to this application
  // so retries remain idempotent.
  if (application.screening) {
    const assigned = await Screening.findOne({
      _id: application.screening,
      organization,
      source: 'website',
    });
    if (assigned) return assigned;
  }

  let screening = await Screening.findOne({
    organization,
    websiteApplication: application._id,
    source: 'website',
  });

  if (screening) return screening;

  try {
    return await Screening.create({
      organization,
      recruiter,
      websiteApplication: application._id,
      jobDescriptionRef: jobDescription._id,
      jobDescriptionTitle: jobDescription.title,
      jobDescription: jobDescription.description,
      source: 'website',
      totalCandidates: 0,
      parsedCandidates: 0,
      failedCandidates: 0,
      analyzedCandidates: 0,
      failedAnalysisCandidates: 0,
      status: 'processing',
      analysisStatus: 'pending',
    });
  } catch (error) {
    // Two retries for the same website application can race. The unique
    // per-application index makes one win and the other reuse it.
    if (error?.code === 11000) {
      screening = await Screening.findOne({
        organization,
        websiteApplication: application._id,
        source: 'website',
      });
      if (screening) return screening;
    }
    throw error;
  }
}

async function recalculateScreeningTotals(screeningId) {
  const totalCandidates = await Candidate.countDocuments({ screening: screeningId });

  await Screening.updateOne(
    { _id: screeningId },
    {
      $set: {
        totalCandidates,
        // Part 4 only promotes. Part 5 will recalculate parsing/AI counters.
        status: 'processing',
        analysisStatus: 'pending',
      },
    },
  );
}

async function ensureCandidate({ application, screening, recruiter, organization }) {
  if (application.candidate) {
    const candidate = await Candidate.findOne({
      _id: application.candidate,
      screening: screening._id,
    });

    if (candidate) return { candidate, created: false };
  }

  let candidate = await Candidate.findOne({
    websiteApplication: application._id,
  });

  if (candidate) return { candidate, created: false };

  try {
    candidate = await Candidate.create({
      screening: screening._id,
      recruiter,
      websiteApplication: application._id,
      originalFileName: application.resumeOriginalName,
      storedFileName: application.resumeStoredName,
      filePath: application.resumePath,
      fileType: application.resumeFileType,
      fileSize: application.resumeFileSize,
      parsingStatus: 'pending',
      analysisStatus: 'pending',
      workflowStatus: 'new',
    });

    await recordCandidateEvent({
      organization,
      screening: screening._id,
      candidate: candidate._id,
      actor: recruiter,
      type: 'resume_uploaded',
      title: 'Website applicant selected for screening',
      description: `${application.fullName} was promoted from Website Applications into the TalentLens screening workflow.`,
      metadata: {
        source: application.source,
        externalApplicationId: application.externalApplicationId,
        externalJobId: application.externalJobId,
        websiteApplicationId: application._id.toString(),
      },
      occurredAt: new Date(),
    });

    return { candidate, created: true };
  } catch (error) {
    if (error?.code === 11000) {
      candidate = await Candidate.findOne({
        websiteApplication: application._id,
      });

      if (candidate) return { candidate, created: false };
    }

    throw error;
  }
}

export async function promoteWebsiteApplications({
  organization,
  recruiter,
  applicationIds,
  allowFailedRecovery = false,
}) {
  const applications = await WebsiteApplication.find({
    _id: { $in: applicationIds },
    organization,
  }).populate(
    'jobDescription',
    'title description department status acceptWebsiteApplications externalSource externalJobId',
  );

  if (applications.length !== applicationIds.length) {
    throw new AppError(
      'One or more selected website applications were not found in your organization.',
      404,
      { code: 'WEBSITE_APPLICATION_NOT_FOUND' },
    );
  }

  const invalid = applications.filter((application) => {
    const jd = application.jobDescription;
    return (
      application.mappingStatus !== 'mapped' ||
      !jd ||
      jd.status !== 'active' ||
      jd.externalSource !== 'wordpress' ||
      jd.externalJobId !== application.externalJobId ||
      !jd.acceptWebsiteApplications
    );
  });

  if (invalid.length) {
    throw new AppError(
      'One or more selected applications do not have an active TalentLens JD mapping.',
      409,
      {
        code: 'JD_MAPPING_REQUIRED',
        applicationIds: invalid.map((item) => item._id.toString()),
      },
    );
  }

  const disallowed = applications.filter(
    (application) =>
      !['ready_for_review', 'selected_for_screening', 'screening', ...(allowFailedRecovery ? ['failed'] : [])].includes(
        application.status,
      ),
  );

  if (disallowed.length) {
    throw new AppError(
      'Only applications that are ready for review can be selected for screening.',
      409,
      {
        code: 'APPLICATION_NOT_READY_FOR_SCREENING',
        applicationIds: disallowed.map((item) => item._id.toString()),
      },
    );
  }

  const screeningCache = new Map();
  const touchedScreeningIds = new Set();
  const promoted = [];
  const alreadyPromoted = [];

  // Preserve caller order for a predictable API response.
  const applicationById = new Map(
    applications.map((application) => [application._id.toString(), application]),
  );

  for (const applicationId of applicationIds) {
    const application = applicationById.get(applicationId);
    const jd = application.jobDescription;
    const applicationKey = application._id.toString();

    let screening = screeningCache.get(applicationKey);
    if (!screening) {
      screening = await getOrCreateWebsiteScreening({
        organization,
        jobDescription: jd,
        recruiter,
        application,
      });
      screeningCache.set(applicationKey, screening);
    }

    const { candidate, created } = await ensureCandidate({
      application,
      screening,
      recruiter,
      organization,
    });

    application.screening = screening._id;
    application.candidate = candidate._id;
    application.status = 'selected_for_screening';
    application.parsingStatus = candidate.parsingStatus;
    application.analysisStatus = candidate.analysisStatus;
    application.lastError = '';
    await application.save();

    touchedScreeningIds.add(screening._id.toString());

    const item = {
      applicationId: application._id.toString(),
      candidateId: candidate._id.toString(),
      screeningId: screening._id.toString(),
      jobDescriptionId: jd._id.toString(),
      jobDescriptionTitle: jd.title,
      status: application.status,
    };

    if (created) promoted.push(item);
    else alreadyPromoted.push(item);
  }

  await Promise.all(
    [...touchedScreeningIds].map((screeningId) =>
      recalculateScreeningTotals(screeningId),
    ),
  );

  const screeningGroups = [...screeningCache.values()].map((screening) => {
    const screeningId = screening._id.toString();
    const related = [...promoted, ...alreadyPromoted].filter(
      (item) => item.screeningId === screeningId,
    );

    return {
      screeningId,
      jobDescriptionId: screening.jobDescriptionRef.toString(),
      jobDescriptionTitle: screening.jobDescriptionTitle,
      selectedCount: related.length,
    };
  });

  return {
    promoted,
    alreadyPromoted,
    screeningGroups,
  };
}
