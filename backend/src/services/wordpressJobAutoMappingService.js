import { JobDescription } from '../models/JobDescription.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { WebsiteApplication } from '../models/WebsiteApplication.js';

export function normalizeJobTitle(value = '') {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value = '') {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => {
      const number = Number(code);
      return Number.isFinite(number) ? String.fromCharCode(number) : '';
    });
}

export function normalizeJobDescription(value = '') {
  const withBreaks = String(value || '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ');

  return decodeHtmlEntities(withBreaks)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 30000);
}

async function updatePendingApplications({
  organization,
  externalJobId,
  jobDescription,
}) {
  const result = await WebsiteApplication.updateMany(
    {
      organization,
      externalJobId,
      mappingStatus: 'mapping_required',
      status: { $in: ['received', 'jd_mapping_required'] },
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

  return result.modifiedCount || 0;
}

async function resolveSystemActor(organization) {
  const org = await Organization.findById(organization).select('createdBy');
  if (org?.createdBy) return org.createdBy;

  const user = await User.findOne({
    organization,
    isActive: true,
    role: { $in: ['admin', 'recruiter'] },
  })
    .sort({ role: 1, createdAt: 1 })
    .select('_id');

  return user?._id || null;
}

async function createWordPressJobDescription({
  organization,
  externalJobId,
  jobTitle,
  jobDescription,
  jobUrl,
}) {
  const description = normalizeJobDescription(jobDescription);

  // A real JD is required for safe AI screening. Never create a placeholder
  // JD from only a title.
  if (description.length < 30) {
    return {
      jobDescription: null,
      created: false,
      reason: 'job_description_required',
    };
  }

  const actor = await resolveSystemActor(organization);
  if (!actor) {
    return {
      jobDescription: null,
      created: false,
      reason: 'system_actor_not_found',
    };
  }

  try {
    const created = await JobDescription.create({
      organization,
      title: String(jobTitle || '').trim(),
      description,
      status: 'active',
      externalSource: 'wordpress',
      externalJobId: String(externalJobId || '').trim(),
      externalJobTitle: String(jobTitle || '').trim(),
      externalJobUrl: String(jobUrl || '').trim(),
      acceptWebsiteApplications: true,
      createdBy: actor,
      updatedBy: actor,
    });

    return {
      jobDescription: created,
      created: true,
      reason: 'auto_created_from_wordpress',
    };
  } catch (error) {
    // Concurrent applications for the same WordPress job may both attempt to
    // create the mapping. Reuse whichever request won the unique index race.
    if (error?.code === 11000) {
      const concurrent = await JobDescription.findOne({
        organization,
        externalSource: 'wordpress',
        externalJobId: String(externalJobId || '').trim(),
        status: 'active',
        acceptWebsiteApplications: true,
      });

      if (concurrent) {
        return {
          jobDescription: concurrent,
          created: false,
          reason: 'concurrent_auto_create',
        };
      }
    }

    throw error;
  }
}

export async function resolveOrAutoMapWordPressJob({
  organization,
  externalJobId,
  jobTitle,
  jobDescription = '',
  jobUrl = '',
}) {
  const normalizedExternalJobId = String(externalJobId || '').trim();
  const normalizedTitle = normalizeJobTitle(jobTitle);

  if (!normalizedExternalJobId || !normalizedTitle) {
    return {
      jobDescription: null,
      autoMapped: false,
      autoCreated: false,
      applicationsMapped: 0,
      reason: 'missing_job_identity',
    };
  }

  // 1. Existing WordPress Job ID mapping is authoritative and always wins.
  const existingMapping = await JobDescription.findOne({
    organization,
    externalSource: 'wordpress',
    externalJobId: normalizedExternalJobId,
  });

  if (existingMapping) {
    if (
      existingMapping.status === 'active' &&
      existingMapping.acceptWebsiteApplications
    ) {
      const applicationsMapped = await updatePendingApplications({
        organization,
        externalJobId: normalizedExternalJobId,
        jobDescription: existingMapping,
      });

      return {
        jobDescription: existingMapping,
        autoMapped: false,
        autoCreated: false,
        applicationsMapped,
        reason: 'existing_mapping',
      };
    }

    return {
      jobDescription: null,
      autoMapped: false,
      autoCreated: false,
      applicationsMapped: 0,
      reason: 'existing_mapping_disabled',
    };
  }

  // 2. No Job ID mapping exists. Try one exact normalized title match.
  const activeJobDescriptions = await JobDescription.find({
    organization,
    status: 'active',
  }).select(
    '_id title status externalSource externalJobId externalJobTitle externalJobUrl acceptWebsiteApplications updatedBy',
  );

  const exactMatches = activeJobDescriptions.filter((jd) => {
    if (normalizeJobTitle(jd.title) !== normalizedTitle) return false;

    // Never steal a JD that is deliberately mapped to a different WordPress
    // Job ID.
    if (
      jd.externalSource === 'wordpress' &&
      jd.externalJobId &&
      jd.externalJobId !== normalizedExternalJobId
    ) {
      return false;
    }

    return true;
  });

  if (exactMatches.length === 1) {
    const mapped = exactMatches[0];
    mapped.externalSource = 'wordpress';
    mapped.externalJobId = normalizedExternalJobId;
    mapped.externalJobTitle = String(jobTitle || '').trim() || mapped.title;
    mapped.externalJobUrl = String(jobUrl || '').trim();
    mapped.acceptWebsiteApplications = true;

    try {
      await mapped.save();
    } catch (error) {
      if (error?.code === 11000) {
        const concurrentMapping = await JobDescription.findOne({
          organization,
          externalSource: 'wordpress',
          externalJobId: normalizedExternalJobId,
          status: 'active',
          acceptWebsiteApplications: true,
        });

        if (concurrentMapping) {
          const applicationsMapped = await updatePendingApplications({
            organization,
            externalJobId: normalizedExternalJobId,
            jobDescription: concurrentMapping,
          });

          return {
            jobDescription: concurrentMapping,
            autoMapped: false,
            autoCreated: false,
            applicationsMapped,
            reason: 'concurrent_mapping',
          };
        }
      }

      throw error;
    }

    const applicationsMapped = await updatePendingApplications({
      organization,
      externalJobId: normalizedExternalJobId,
      jobDescription: mapped,
    });

    return {
      jobDescription: mapped,
      autoMapped: true,
      autoCreated: false,
      applicationsMapped,
      reason: 'exact_title_match',
    };
  }

  // 3. If there are multiple exact matches, do not guess. Manual mapping is
  // safer than creating another duplicate JD.
  if (exactMatches.length > 1) {
    return {
      jobDescription: null,
      autoMapped: false,
      autoCreated: false,
      applicationsMapped: 0,
      reason: 'ambiguous_title',
    };
  }

  // 4. No existing mapping and no exact TalentLens JD. When WordPress sends
  // the complete JD, create it once and map the external Job ID automatically.
  const createdResult = await createWordPressJobDescription({
    organization,
    externalJobId: normalizedExternalJobId,
    jobTitle,
    jobDescription,
    jobUrl,
  });

  if (!createdResult.jobDescription) {
    return {
      jobDescription: null,
      autoMapped: false,
      autoCreated: false,
      applicationsMapped: 0,
      reason: createdResult.reason,
    };
  }

  const applicationsMapped = await updatePendingApplications({
    organization,
    externalJobId: normalizedExternalJobId,
    jobDescription: createdResult.jobDescription,
  });

  return {
    jobDescription: createdResult.jobDescription,
    autoMapped: false,
    autoCreated: createdResult.created,
    applicationsMapped,
    reason: createdResult.reason,
  };
}

export async function autoMapPendingWordPressApplications({ organization }) {
  const pendingJobs = await WebsiteApplication.aggregate([
    {
      $match: {
        organization,
        mappingStatus: 'mapping_required',
        status: { $in: ['received', 'jd_mapping_required'] },
      },
    },
    { $sort: { appliedAt: -1, receivedAt: -1 } },
    {
      $group: {
        _id: '$externalJobId',
        jobTitle: { $first: '$jobTitle' },
        jobUrl: { $first: '$jobUrl' },
        // $max intentionally prefers a non-empty description over older empty
        // snapshots for the same WordPress job.
        jobDescription: { $max: '$externalJobDescription' },
        pendingApplicationCount: { $sum: 1 },
      },
    },
  ]);

  let jobsMapped = 0;
  let jobsCreated = 0;
  let applicationsMapped = 0;
  const results = [];

  for (const job of pendingJobs) {
    const result = await resolveOrAutoMapWordPressJob({
      organization,
      externalJobId: job._id,
      jobTitle: job.jobTitle,
      jobDescription: job.jobDescription || '',
      jobUrl: job.jobUrl || '',
    });

    if (result.autoMapped) jobsMapped += 1;
    if (result.autoCreated) jobsCreated += 1;
    applicationsMapped += result.applicationsMapped || 0;

    results.push({
      externalJobId: job._id,
      jobTitle: job.jobTitle || '',
      pendingApplicationCount: job.pendingApplicationCount,
      mappingStatus: result.jobDescription ? 'mapped' : 'mapping_required',
      autoMapped: result.autoMapped,
      autoCreated: result.autoCreated,
      applicationsMapped: result.applicationsMapped || 0,
      reason: result.reason,
      jobDescriptionId: result.jobDescription?._id?.toString() || null,
      jobDescriptionTitle: result.jobDescription?.title || null,
    });
  }

  return {
    jobsChecked: pendingJobs.length,
    jobsMapped,
    jobsCreated,
    applicationsMapped,
    results,
  };
}
