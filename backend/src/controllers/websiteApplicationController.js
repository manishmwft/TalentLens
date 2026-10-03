import path from 'path';
import { WebsiteApplication } from '../models/WebsiteApplication.js';
import { resolveOrAutoMapWordPressJob } from '../services/wordpressJobAutoMappingService.js';
import { queueWebsiteApplicationAutoScreening } from '../services/websiteApplicationAutoScreeningService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadPublicFile, deleteBlob } from '../services/blobStorageService.js';

async function removeBlob(url) {
  if (!url) return;
  try { await deleteBlob(url); } catch (error) { console.error('Blob cleanup failed:', error); }
}

function fileTypeFromName(name = '') {
  return path.extname(name).toLowerCase() === '.docx' ? 'docx' : 'pdf';
}

function serializeApplication(application) {
  const jobDescriptionId = application.jobDescription?._id
    ? application.jobDescription._id.toString()
    : application.jobDescription
      ? application.jobDescription.toString()
      : null;

  const mappedTitle = application.jobDescription?.title || null;

  return {
    applicationId: application._id.toString(),
    candidateId: application.candidate ? application.candidate.toString() : null,
    screeningId: application.screening ? application.screening.toString() : null,
    externalApplicationId: application.externalApplicationId,
    job: {
      externalId: application.externalJobId,
      title: application.jobTitle,
      url: application.jobUrl || '',
      mappingStatus: application.mappingStatus,
      talentLensJobDescriptionId: jobDescriptionId,
      talentLensJobDescriptionTitle: mappedTitle,
    },
    candidate: {
      fullName: application.fullName,
      email: application.email,
      phone: application.phone || '',
      resumeFilename: application.resumeOriginalName,
    },
    source: application.source,
    status: application.status,
    appliedAt: application.appliedAt,
    receivedAt: application.receivedAt,
    processing: {
      resumeParsing: application.parsingStatus,
      aiAnalysis: application.analysisStatus,
    },
  };
}

async function findExistingApplication({
  organization,
  externalApplicationId,
  idempotencyKey,
}) {
  return WebsiteApplication.findOne({
    organization,
    $or: [{ externalApplicationId }, { idempotencyKey }],
  }).populate('jobDescription', 'title');
}

async function enrichExistingApplication({ existing, organization, body }) {
  let changed = false;

  // This supports backfilling old applications after the WordPress plugin is
  // upgraded to send jobDescription. The same external application can be
  // safely retried with the same Idempotency-Key.
  if (!existing.externalJobDescription && body.jobDescription) {
    existing.externalJobDescription = body.jobDescription;
    changed = true;
  }

  if (!existing.jobUrl && body.jobUrl) {
    existing.jobUrl = body.jobUrl;
    changed = true;
  }

  if (changed) await existing.save();

  if (existing.mappingStatus !== 'mapped') {
    const mappingResult = await resolveOrAutoMapWordPressJob({
      organization,
      externalJobId: existing.externalJobId,
      jobTitle: existing.jobTitle,
      jobDescription: existing.externalJobDescription || body.jobDescription || '',
      jobUrl: existing.jobUrl || body.jobUrl || '',
    });

    if (mappingResult.jobDescription) {
      existing.jobDescription = mappingResult.jobDescription;
      existing.mappingStatus = 'mapped';
      if (['received', 'jd_mapping_required'].includes(existing.status)) {
        existing.status = 'ready_for_review';
      }
      existing.lastError = '';
      await existing.save();
    }
  }

  return existing;
}

export const createPublicJobApplication = asyncHandler(async (req, res) => {
  const organization = req.integration.organizationId;
  const idempotencyKey = String(req.get('idempotency-key') || '').trim();

  if (!idempotencyKey) {
    throw new AppError('Idempotency-Key header is required.', 400, {
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });
  }

  if (idempotencyKey.length > 240) {
    throw new AppError('Idempotency-Key is too long.', 400, {
      code: 'IDEMPOTENCY_KEY_INVALID',
    });
  }

  let existing = await findExistingApplication({
    organization,
    externalApplicationId: req.body.externalApplicationId,
    idempotencyKey,
  });

  if (existing) {
    existing = await enrichExistingApplication({
      existing,
      organization,
      body: req.body,
    });

    res.status(200).json({
      success: true,
      message: existing.mappingStatus === 'mapped'
        ? 'Application already received and job mapping is ready.'
        : 'Application already received.',
      duplicate: true,
      data: serializeApplication(existing),
    });
    return;
  }

  if (!req.file) {
    throw new AppError('Resume file is required.', 400, {
      code: 'RESUME_REQUIRED',
    });
  }

  const mappingResult = await resolveOrAutoMapWordPressJob({
    organization,
    externalJobId: req.body.externalJobId,
    jobTitle: req.body.jobTitle,
    jobDescription: req.body.jobDescription || '',
    jobUrl: req.body.jobUrl || '',
  });

  const jobDescription = mappingResult.jobDescription;
  const mappingStatus = jobDescription ? 'mapped' : 'mapping_required';
  const status = jobDescription ? 'ready_for_review' : 'jd_mapping_required';

  const blob = await uploadPublicFile({
    organizationId: organization,
    category: 'website-resumes',
    ownerId: req.body.externalApplicationId,
    filename: req.file.originalname,
    data: req.file.buffer,
    contentType: req.file.mimetype,
  });

  let application;
  try {
    application = await WebsiteApplication.create({
      organization,
      integrationCredential: req.integration.credentialId,
      jobDescription: jobDescription?._id || null,

      externalApplicationId: req.body.externalApplicationId,
      externalJobId: req.body.externalJobId,
      jobTitle: req.body.jobTitle,
      jobUrl: req.body.jobUrl || '',
      externalJobDescription: req.body.jobDescription || '',

      fullName: req.body.fullName,
      email: req.body.email,
      phone: req.body.phone || '',
      coverLetter: req.body.coverLetter || '',

      resumeOriginalName: req.file.originalname,
      resumeStoredName: blob.pathname,
      resumePath: blob.url,
      resumeFileType: fileTypeFromName(req.file.originalname),
      resumeFileSize: req.file.size,

      idempotencyKey,
      appliedAt: req.body.appliedAt ? new Date(req.body.appliedAt) : null,
      mappingStatus,
      status,
      parsingStatus: 'pending',
      analysisStatus: 'pending',
      autoScreenEligible: true,
    });
  } catch (error) {
    if (error?.code === 11000) {
      let duplicate = await findExistingApplication({
        organization,
        externalApplicationId: req.body.externalApplicationId,
        idempotencyKey,
      });

      if (duplicate) {
        duplicate = await enrichExistingApplication({
          existing: duplicate,
          organization,
          body: req.body,
        });

        await removeBlob(blob.url);
        res.status(200).json({
          success: true,
          message: 'Application already received.',
          duplicate: true,
          data: serializeApplication(duplicate),
        });
        return;
      }
    }

    await removeBlob(blob.url);
    throw error;
  }

  if (jobDescription) application.jobDescription = jobDescription;

  // IMPORTANT: queue automation only for the application created in this request.
  // Historical rows retain autoScreenEligible=false and are never picked up in bulk.
  if (jobDescription) {
    queueWebsiteApplicationAutoScreening({
      organization,
      applicationId: application._id,
      preferredActorId: req.integration.createdBy,
    });
  }

  res.status(201).json({
    success: true,
    message: jobDescription
      ? mappingResult.autoCreated
        ? 'Application received successfully. TalentLens job description was created and mapped automatically.'
        : 'Application received successfully and matched to a TalentLens job description.'
      : mappingResult.reason === 'job_description_required'
        ? 'Application received successfully. Send jobDescription or map the job manually before screening.'
        : 'Application received successfully. Job description mapping is required before screening.',
    duplicate: false,
    data: serializeApplication(application),
    mapping: {
      reason: mappingResult.reason,
      autoMapped: Boolean(mappingResult.autoMapped),
      autoCreated: Boolean(mappingResult.autoCreated),
      applicationsMapped: mappingResult.applicationsMapped || 0,
    },
  });
});
