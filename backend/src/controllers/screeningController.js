import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { Candidate } from '../models/Candidate.js';
import { Screening } from '../models/Screening.js';
import { JobDescription } from '../models/JobDescription.js';
import { analyzeResume } from '../services/geminiResumeService.js';
import { extractResumeText } from '../services/resumeParserService.js';
import { extractContactDetails } from '../utils/contactExtractor.js';
import { recordCandidateEvent } from '../services/candidateTimelineService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadPublicFile, deleteBlob } from '../services/blobStorageService.js';
import { WebsiteApplication } from '../models/WebsiteApplication.js';
import { processPromotedWebsiteApplications } from '../services/websiteApplicationProcessingService.js';


function screeningAccessFilter(user, extra = {}) {
  const organizationAccess = user.organization
    ? { organization: user.organization }
    : { recruiter: user._id };
  return { ...extra, ...organizationAccess };
}

async function findAccessibleScreening(user, screeningId) {
  return Screening.findOne(screeningAccessFilter(user, { _id: screeningId }));
}

async function deleteUploadedFiles(_files = []) {
  // Resumes are held in memory until persisted to Vercel Blob. Nothing is written locally.
}

function serializeCandidate(candidate, includeText = true) {
  const extractedContact = extractContactDetails(candidate.extractedText);
  let normalizedAnalysis = candidate.analysis
    ? candidate.analysis.toObject
      ? candidate.analysis.toObject()
      : { ...candidate.analysis }
    : null;

  if (normalizedAnalysis) {
    normalizedAnalysis = {
      ...normalizedAnalysis,
      email: extractedContact.email || normalizedAnalysis.email || '',
      phone: extractedContact.phone || normalizedAnalysis.phone || '',
    };
  }

  return {
    id: candidate._id.toString(),
    screeningId: candidate.screening.toString(),
    originalFileName: candidate.originalFileName,
    storedFileName: candidate.storedFileName,
    fileType: candidate.fileType,
    fileSize: candidate.fileSize,
    ...(includeText ? { extractedText: candidate.extractedText } : {}),
    parsingStatus: candidate.parsingStatus,
    parsingError: candidate.parsingError,
    analysisStatus: candidate.analysisStatus,
    analysisError: candidate.analysisError,
    analysis: normalizedAnalysis,
    analyzedAt: candidate.analyzedAt,
    aiProvider: candidate.aiProvider,
    aiModel: candidate.aiModel,
    workflowStatus: candidate.workflowStatus || 'new',
    recruiterNotes: candidate.recruiterNotes || '',
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

function serializeScreening(screening, summary = {}) {
  return {
    id: screening._id.toString(),
    jobDescription: screening.jobDescription,
    jobDescriptionId: screening.jobDescriptionRef?.toString?.() || screening.jobDescriptionRef || null,
    jobDescriptionTitle: screening.jobDescriptionTitle || '',
    totalCandidates: screening.totalCandidates,
    parsedCandidates: screening.parsedCandidates,
    failedCandidates: screening.failedCandidates,
    analyzedCandidates: screening.analyzedCandidates || 0,
    failedAnalysisCandidates: screening.failedAnalysisCandidates || 0,
    status: screening.status,
    analysisStatus: screening.analysisStatus || 'pending',
    createdAt: screening.createdAt,
    updatedAt: screening.updatedAt,
    resumeFileNames: summary.resumeFileNames || [],
    primaryFileName: summary.primaryFileName || '',
    averageMatchScore: summary.averageMatchScore ?? null,
    topCandidateName: summary.topCandidateName || '',
    topScore: summary.topScore ?? null,
  };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );

  return results;
}

async function analyzeCandidate(candidate, jobDescription) {
  candidate.analysisStatus = 'processing';
  candidate.analysisError = '';
  candidate.aiProvider = '';
  candidate.aiModel = '';
  candidate.aiResponseId = '';
  await candidate.save();

  try {
    const result = await analyzeResume({
      resumeText: candidate.extractedText,
      jobDescription,
    });

    const extractedContact = extractContactDetails(candidate.extractedText);
    const aiAnalysis = result.analysis || {};

    candidate.analysis = {
      ...aiAnalysis,
      email: extractedContact.email || aiAnalysis.email || '',
      phone: extractedContact.phone || aiAnalysis.phone || '',
    };
    candidate.analysisStatus = 'completed';
    candidate.analysisError = '';
    candidate.analyzedAt = new Date();
    candidate.aiProvider = result.provider;
    candidate.aiModel = result.model;
    candidate.aiResponseId = result.responseId;
  } catch (error) {
    candidate.analysisStatus = 'failed';
    candidate.analysisError = error.message || 'AI analysis failed';
  }

  await candidate.save();
  return candidate;
}

async function analyzeScreeningCandidates(screening, candidates) {
  const parsedCandidates = candidates.filter(
    (candidate) => candidate.parsingStatus === 'parsed',
  );

  if (!parsedCandidates.length) {
    screening.analysisStatus = 'failed';
    screening.analyzedCandidates = 0;
    screening.failedAnalysisCandidates = 0;
    await screening.save();
    return candidates;
  }

  screening.analysisStatus = 'processing';
  await screening.save();

  await mapWithConcurrency(
    parsedCandidates,
    env.aiConcurrency,
    (candidate) => analyzeCandidate(candidate, screening.jobDescription),
  );

  const analyzedCandidates = parsedCandidates.filter(
    (candidate) => candidate.analysisStatus === 'completed',
  ).length;
  const failedAnalysisCandidates = parsedCandidates.length - analyzedCandidates;

  screening.analyzedCandidates = analyzedCandidates;
  screening.failedAnalysisCandidates = failedAnalysisCandidates;
  screening.analysisStatus =
    analyzedCandidates === parsedCandidates.length
      ? 'completed'
      : analyzedCandidates > 0
        ? 'partially_completed'
        : 'failed';

  await screening.save();
  return candidates;
}

export const createScreening = asyncHandler(async (req, res) => {
  const files = req.files || [];
  const requestedJobDescriptionId = String(req.body.jobDescriptionId || '').trim();
  let jobDescription = String(req.body.jobDescription || '').trim();
  let selectedJobDescription = null;

  if (requestedJobDescriptionId) {
    selectedJobDescription = await JobDescription.findOne({
      _id: requestedJobDescriptionId,
      organization: req.user.organization,
      status: 'active',
    });

    if (!selectedJobDescription) {
      await deleteUploadedFiles(files);
      throw new AppError('Selected job description was not found or is not active', 400);
    }

    // Always use the server-side JD snapshot so edited form data cannot mismatch the selected JD.
    jobDescription = selectedJobDescription.description;
  }

  if (!files.length) {
    throw new AppError('Upload at least one PDF or DOCX resume', 400);
  }

  if (jobDescription.length < 30) {
    await deleteUploadedFiles(files);
    throw new AppError('Job description must contain at least 30 characters', 400);
  }

  let screening;

  try {
    screening = await Screening.create({
      organization: req.user.organization,
      recruiter: req.user._id,
      jobDescriptionRef: selectedJobDescription?._id || null,
      jobDescriptionTitle: selectedJobDescription?.title || '',
      jobDescription,
      totalCandidates: files.length,
      status: 'processing',
      analysisStatus: 'pending',
    });

    const candidates = [];

    for (const file of files) {
      const extension = path.extname(file.originalname).slice(1).toLowerCase();
      const blob = await uploadPublicFile({
        organizationId: req.user.organization,
        category: 'resumes',
        ownerId: screening._id,
        filename: file.originalname,
        data: file.buffer,
        contentType: file.mimetype,
      });

      let candidate;
      try {
        candidate = await Candidate.create({
          screening: screening._id,
          recruiter: req.user._id,
          originalFileName: file.originalname,
          storedFileName: blob.pathname,
          filePath: blob.url,
          fileType: extension,
          fileSize: file.size,
        });
      } catch (error) {
        await deleteBlob(blob.url).catch(() => {});
        throw error;
      }

      try {
        candidate.extractedText = await extractResumeText(file);
        candidate.parsingStatus = 'parsed';
        candidate.parsingError = '';
      } catch (error) {
        candidate.parsingStatus = 'failed';
        candidate.parsingError = error.message || 'Resume parsing failed';
        candidate.analysisStatus = 'failed';
        candidate.analysisError = 'AI analysis was skipped because parsing failed.';
      }

      await candidate.save();
      candidates.push(candidate);
    }

    const parsedCandidates = candidates.filter(
      (candidate) => candidate.parsingStatus === 'parsed',
    ).length;
    const failedCandidates = candidates.length - parsedCandidates;

    screening.parsedCandidates = parsedCandidates;
    screening.failedCandidates = failedCandidates;
    screening.status =
      parsedCandidates === candidates.length
        ? 'completed'
        : parsedCandidates > 0
          ? 'partially_completed'
          : 'failed';

    await screening.save();
    await analyzeScreeningCandidates(screening, candidates);

    candidates.sort(
      (a, b) => (b.analysis?.matchScore || -1) - (a.analysis?.matchScore || -1),
    );

    res.status(201).json({
      success: true,
      message: 'Resumes uploaded, parsed, and analyzed',
      screening: serializeScreening(screening),
      candidates: candidates.map((candidate) => serializeCandidate(candidate)),
    });
  } catch (error) {
    if (!screening) await deleteUploadedFiles(files);
    throw error;
  }
});

export const listScreenings = asyncHandler(async (req, res) => {
  const screenings = await Screening.find(screeningAccessFilter(req.user))
    .sort({ createdAt: -1 })
    .lean();

  const screeningIds = screenings.map((screening) => screening._id);
  const candidates = screeningIds.length
    ? await Candidate.find({
        screening: { $in: screeningIds },
      })
        .select('screening originalFileName analysis analysisStatus')
        .lean()
    : [];

  const summaries = new Map();

  for (const candidate of candidates) {
    const key = candidate.screening.toString();
    const current = summaries.get(key) || {
      resumeFileNames: [],
      scores: [],
      topCandidateName: '',
      topScore: null,
    };

    if (candidate.originalFileName) {
      current.resumeFileNames.push(candidate.originalFileName);
    }

    const score = Number(candidate.analysis?.matchScore);
    if (candidate.analysisStatus === 'completed' && Number.isFinite(score)) {
      current.scores.push(score);
      if (current.topScore === null || score > current.topScore) {
        current.topScore = score;
        current.topCandidateName =
          candidate.analysis?.candidateName || candidate.originalFileName || '';
      }
    }

    summaries.set(key, current);
  }

  const serialized = screenings.map((screening) => {
    const summary = summaries.get(screening._id.toString()) || {
      resumeFileNames: [],
      scores: [],
      topCandidateName: '',
      topScore: null,
    };

    const averageMatchScore = summary.scores.length
      ? Math.round(
          summary.scores.reduce((total, score) => total + score, 0) /
            summary.scores.length,
        )
      : null;

    return serializeScreening(screening, {
      resumeFileNames: summary.resumeFileNames,
      primaryFileName: summary.resumeFileNames[0] || '',
      averageMatchScore,
      topCandidateName: summary.topCandidateName,
      topScore: summary.topScore,
    });
  });

  res.json({
    success: true,
    screenings: serialized,
  });
});


export const listComparisonCandidates = asyncHandler(async (req, res) => {
  const jobDescriptionId = String(req.query.jobDescriptionId || '').trim();

  if (!jobDescriptionId) {
    throw new AppError('Select a job description before loading comparison candidates', 400);
  }

  const screenings = await Screening.find(
    screeningAccessFilter(req.user, { jobDescriptionRef: jobDescriptionId }),
  )
    .select('_id jobDescriptionRef jobDescriptionTitle source createdAt')
    .lean();

  if (!screenings.length) {
    return res.json({ success: true, candidates: [] });
  }

  const screeningById = new Map(
    screenings.map((screening) => [screening._id.toString(), screening]),
  );

  const candidates = await Candidate.find({
    screening: { $in: screenings.map((screening) => screening._id) },
    analysisStatus: 'completed',
    analysis: { $exists: true },
  })
    .populate({ path: 'websiteApplication', select: 'appliedAt source' })
    .sort({ 'analysis.matchScore': -1, createdAt: -1 });

  const serialized = candidates.map((candidate) => {
    const screening = screeningById.get(candidate.screening.toString());
    const base = serializeCandidate(candidate, false);
    const websiteApplication = candidate.websiteApplication;

    return {
      ...base,
      jobDescriptionId: screening?.jobDescriptionRef?.toString?.() || jobDescriptionId,
      jobDescriptionTitle: screening?.jobDescriptionTitle || '',
      source: websiteApplication ? 'website' : (screening?.source || 'manual'),
      appliedAt: websiteApplication?.appliedAt || candidate.createdAt,
    };
  });

  res.json({ success: true, candidates: serialized });
});

export const getScreening = asyncHandler(async (req, res) => {
  const screening = await findAccessibleScreening(req.user, req.params.screeningId);

  if (!screening) throw new AppError('Screening not found', 404);

  const candidates = await Candidate.find({
    screening: screening._id,
  }).sort({ 'analysis.matchScore': -1, createdAt: 1 });

  res.json({
    success: true,
    screening: serializeScreening(screening),
    candidates: candidates.map((candidate) => serializeCandidate(candidate)),
  });
});

export const reanalyzeScreening = asyncHandler(async (req, res) => {
  const screening = await findAccessibleScreening(req.user, req.params.screeningId);

  if (!screening) throw new AppError('Screening not found', 404);

  // Website screenings reuse their original application, candidate and screening.
  // This also retries failed resume parsing instead of requiring parsed text first.
  if (screening.source === 'website') {
    const application = await WebsiteApplication.findOne({
      organization: screening.organization,
      $or: [{ screening: screening._id }, { _id: screening.websiteApplication }],
    });
    if (!application) {
      throw new AppError('Original website application was not found. Retry is unavailable.', 404);
    }
    if (!application.resumePath) {
      throw new AppError('Original resume is unavailable. Restore the resume before re-analyzing.', 400);
    }
    if (!application.candidate) {
      throw new AppError('Website candidate record is missing. The application needs recovery before re-analysis.', 409);
    }
    // Processing service requires this transition; do not create another candidate.
    application.status = 'screening';
    await application.save();
    await processPromotedWebsiteApplications({
      organization: screening.organization,
      actor: req.user,
      applicationIds: [application._id.toString()],
    });
    const updatedScreening = await Screening.findById(screening._id);
    const updatedCandidates = await Candidate.find({ screening: screening._id });
    return res.json({
      success: true,
      message: 'Website candidate re-analysis finished',
      screening: serializeScreening(updatedScreening),
      candidates: updatedCandidates.map((candidate) => serializeCandidate(candidate)),
    });
  }

  const candidates = await Candidate.find({
    screening: screening._id,
    parsingStatus: 'parsed',
  });

  if (!candidates.length) {
    throw new AppError('No parsed candidates are available for analysis', 400);
  }

  for (const candidate of candidates) {
    candidate.analysisStatus = 'pending';
    candidate.analysisError = '';
    await candidate.save();
  }

  screening.analysisStatus = 'pending';
  screening.analyzedCandidates = 0;
  screening.failedAnalysisCandidates = 0;
  await screening.save();

  await analyzeScreeningCandidates(screening, candidates);

  candidates.sort(
    (a, b) => (b.analysis?.matchScore || -1) - (a.analysis?.matchScore || -1),
  );

  res.json({
    success: true,
    message: 'Screening analyzed again',
    screening: serializeScreening(screening),
    candidates: candidates.map((candidate) => serializeCandidate(candidate)),
  });
});


export const downloadCandidateResume = asyncHandler(async (req, res) => {
  const screening = await Screening.findOne(
    screeningAccessFilter(req.user, { _id: req.params.screeningId }),
  ).select('_id');

  if (!screening) throw new AppError('Screening not found', 404);

  const candidate = await Candidate.findOne({
    _id: req.params.candidateId,
    screening: screening._id,
  }).select('filePath originalFileName');

  if (!candidate) throw new AppError('Candidate not found', 404);

  // 01D: candidates uploaded after 01C point directly to public Vercel Blob.
  // Historical local paths remain supported while the old file still exists.
  if (/^https?:\/\//i.test(candidate.filePath)) {
    return res.redirect(302, candidate.filePath);
  }

  const absolutePath = path.resolve(candidate.filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new AppError('Resume file is no longer available on the server', 404, {
      code: 'RESUME_FILE_NOT_FOUND',
    });
  }

  return res.download(absolutePath, candidate.originalFileName);
});

export const downloadScreeningPdf = asyncHandler(async (req, res) => {
  const screening = await findAccessibleScreening(req.user, req.params.screeningId);

  if (!screening) throw new AppError('Screening not found', 404);

  const candidates = await Candidate.find({
    screening: screening._id,
  }).sort({ 'analysis.matchScore': -1, createdAt: 1 });

  const { createScreeningPdf } = await import('../services/screeningReportService.js');
  const pdf = createScreeningPdf({ screening, candidates, recruiter: req.user });
  const filename = `screening-${screening._id}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  pdf.pipe(res);
  pdf.end();
});

export const downloadScreeningCsv = asyncHandler(async (req, res) => {
  const screening = await findAccessibleScreening(req.user, req.params.screeningId);

  if (!screening) throw new AppError('Screening not found', 404);

  const candidates = await Candidate.find({
    screening: screening._id,
  }).sort({ 'analysis.matchScore': -1, createdAt: 1 });

  const { createCandidatesCsv } = await import('../services/screeningReportService.js');
  const csv = createCandidatesCsv(candidates);
  const filename = `screening-${screening._id}-candidates.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`\uFEFF${csv}`);
});


export const exportSelectedScreeningsCsv = asyncHandler(async (req, res) => {
  const requestedIds = [...new Set(req.body.screeningIds)];

  const screenings = await Screening.find({
    ...screeningAccessFilter(req.user),
    _id: { $in: requestedIds },
  }).lean();

  if (!screenings.length) {
    throw new AppError('No matching screenings were found', 404);
  }

  const candidates = await Candidate.find({
    screening: { $in: screenings.map((screening) => screening._id) },
  })
    .select('screening originalFileName analysis analysisStatus')
    .lean();

  const summaries = new Map();
  for (const candidate of candidates) {
    const key = candidate.screening.toString();
    const current = summaries.get(key) || {
      resumeFileNames: [],
      scores: [],
      topCandidateName: '',
      topScore: null,
    };

    if (candidate.originalFileName) current.resumeFileNames.push(candidate.originalFileName);

    const score = Number(candidate.analysis?.matchScore);
    if (candidate.analysisStatus === 'completed' && Number.isFinite(score)) {
      current.scores.push(score);
      if (current.topScore === null || score > current.topScore) {
        current.topScore = score;
        current.topCandidateName =
          candidate.analysis?.candidateName || candidate.originalFileName || '';
      }
    }

    summaries.set(key, current);
  }

  const order = new Map(requestedIds.map((id, index) => [id, index]));
  const rows = screenings
    .map((screening) => {
      const summary = summaries.get(screening._id.toString()) || {
        resumeFileNames: [],
        scores: [],
        topCandidateName: '',
        topScore: null,
      };

      return serializeScreening(screening, {
        resumeFileNames: summary.resumeFileNames,
        primaryFileName: summary.resumeFileNames[0] || '',
        averageMatchScore: summary.scores.length
          ? Math.round(
              summary.scores.reduce((total, score) => total + score, 0) /
                summary.scores.length,
            )
          : null,
        topCandidateName: summary.topCandidateName,
        topScore: summary.topScore,
      });
    })
    .sort((a, b) => order.get(a.id) - order.get(b.id));

  const { createScreeningHistoryCsv } = await import(
    '../services/screeningReportService.js'
  );
  const csv = createScreeningHistoryCsv(rows);
  const date = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="screening-history-${date}.csv"`,
  );
  res.send(csv);
});


export const updateCandidateWorkflowStatus = asyncHandler(async (req, res) => {
  const screening = await findAccessibleScreening(req.user, req.params.screeningId);
  if (!screening) throw new AppError('Screening not found', 404);

  const candidate = await Candidate.findOne({
    _id: req.params.candidateId,
    screening: screening._id,
  });

  if (!candidate) throw new AppError('Candidate not found', 404);

  const previousWorkflowStatus = candidate.workflowStatus || 'new';
  candidate.workflowStatus = req.body.workflowStatus;
  await candidate.save();

  if (previousWorkflowStatus !== candidate.workflowStatus) {
    await recordCandidateEvent({
      organization: screening.organization || req.user.organization,
      screening: screening._id,
      candidate: candidate._id,
      actor: req.user,
      type: 'status_changed',
      title: 'Candidate status changed',
      description: `${previousWorkflowStatus.replaceAll('_', ' ')} → ${candidate.workflowStatus.replaceAll('_', ' ')}`,
      metadata: { previousWorkflowStatus, workflowStatus: candidate.workflowStatus },
    });
  }

  res.json({
    success: true,
    message: 'Candidate status updated',
    candidate: serializeCandidate(candidate),
  });
});

export const updateCandidateNotes = asyncHandler(async (req, res) => {
  const screening = await findAccessibleScreening(req.user, req.params.screeningId);
  if (!screening) throw new AppError('Screening not found', 404);

  const candidate = await Candidate.findOne({
    _id: req.params.candidateId,
    screening: screening._id,
  });

  if (!candidate) throw new AppError('Candidate not found', 404);

  const previousNotes = candidate.recruiterNotes || '';
  candidate.recruiterNotes = String(req.body.recruiterNotes || '').trim();
  await candidate.save();

  if (previousNotes !== candidate.recruiterNotes) {
    await recordCandidateEvent({
      organization: screening.organization || req.user.organization,
      screening: screening._id,
      candidate: candidate._id,
      actor: req.user,
      type: 'notes_updated',
      title: 'Recruiter notes updated',
      description: candidate.recruiterNotes ? 'Private recruiter notes were updated.' : 'Recruiter notes were cleared.',
      metadata: { noteLength: candidate.recruiterNotes.length },
    });
  }

  res.json({
    success: true,
    message: 'Recruiter notes saved',
    candidate: serializeCandidate(candidate),
  });
});
