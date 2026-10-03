import { User } from '../models/User.js';
import { WebsiteApplication } from '../models/WebsiteApplication.js';
import { promoteWebsiteApplications } from './websiteApplicationPromotionService.js';
import { processPromotedWebsiteApplications } from './websiteApplicationProcessingService.js';

async function resolveAutomationActor({ organization, preferredActorId = null }) {
  if (preferredActorId) {
    const preferred = await User.findOne({ _id: preferredActorId, organization, isActive: true });
    if (preferred) return preferred;
  }
  return User.findOne({ organization, isActive: true, role: { $in: ['admin', 'recruiter'] } }).sort({ createdAt: 1 });
}

export async function autoScreenWebsiteApplication({ organization, applicationId, preferredActorId = null }) {
  const application = await WebsiteApplication.findOne({
    _id: applicationId,
    organization,
    autoScreenEligible: true,
  });

  if (!application) return { skipped: true, reason: 'not_eligible' };
  if (application.mappingStatus !== 'mapped' || !application.jobDescription) {
    return { skipped: true, reason: 'jd_mapping_required' };
  }
  if (!['ready_for_review', 'selected_for_screening', 'screening'].includes(application.status)) {
    return { skipped: true, reason: 'already_processed' };
  }

  const actor = await resolveAutomationActor({ organization, preferredActorId });
  if (!actor) {
    application.status = 'failed';
    application.lastError = 'Automatic screening could not start because no active Admin/Recruiter account is available.';
    await application.save();
    return { skipped: false, failed: true, reason: 'automation_actor_missing' };
  }

  try {
    application.autoScreenStartedAt ||= new Date();
    await application.save();

    await promoteWebsiteApplications({
      organization,
      recruiter: actor,
      applicationIds: [application._id.toString()],
    });

    const processing = await processPromotedWebsiteApplications({
      organization,
      actor,
      applicationIds: [application._id.toString()],
    });

    await WebsiteApplication.updateOne(
      { _id: application._id },
      { $set: { autoScreenCompletedAt: new Date() } },
    );

    return { skipped: false, processing };
  } catch (error) {
    await WebsiteApplication.updateOne(
      { _id: application._id },
      { $set: { status: 'failed', lastError: String(error?.message || error).slice(0, 2000) } },
    );
    throw error;
  }
}

export function queueWebsiteApplicationAutoScreening(args) {
  setImmediate(() => {
    autoScreenWebsiteApplication(args).catch((error) => {
      console.error('[Website Auto Screening] Failed:', {
        applicationId: String(args.applicationId),
        message: error?.message || String(error),
      });
    });
  });
}
