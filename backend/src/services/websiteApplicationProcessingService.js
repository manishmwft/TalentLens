import path from 'path';
import { env } from '../config/env.js';
import { Candidate } from '../models/Candidate.js';
import { Screening } from '../models/Screening.js';
import { WebsiteApplication } from '../models/WebsiteApplication.js';
import { analyzeResume } from './geminiResumeService.js';
import { extractResumeText } from './resumeParserService.js';
import { recordCandidateEvent } from './candidateTimelineService.js';
import { extractContactDetails } from '../utils/contactExtractor.js';

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
    Array.from(
      { length: Math.min(Math.max(1, limit), items.length) },
      () => run(),
    ),
  );

  return results;
}

function asResumeFile(application) {
  return {
    originalname: application.resumeOriginalName,
    filename: application.resumeStoredName,
    path: application.resumePath,
    size: application.resumeFileSize,
    mimetype:
      application.resumeFileType === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf',
  };
}

async function recalculateScreening(screeningId) {
  const candidates = await Candidate.find({ screening: screeningId }).select(
    'parsingStatus analysisStatus',
  );

  const totalCandidates = candidates.length;
  const parsedCandidates = candidates.filter(
    (candidate) => candidate.parsingStatus === 'parsed',
  ).length;
  const failedCandidates = candidates.filter(
    (candidate) => candidate.parsingStatus === 'failed',
  ).length;
  const analyzedCandidates = candidates.filter(
    (candidate) => candidate.analysisStatus === 'completed',
  ).length;
  const failedAnalysisCandidates = candidates.filter(
    (candidate) => candidate.analysisStatus === 'failed',
  ).length;

  const status =
    totalCandidates > 0 && parsedCandidates === totalCandidates
      ? 'completed'
      : parsedCandidates > 0
        ? 'partially_completed'
        : failedCandidates > 0
          ? 'failed'
          : 'processing';

  let analysisStatus = 'pending';

  if (candidates.some((candidate) => candidate.analysisStatus === 'processing')) {
    analysisStatus = 'processing';
  } else if (parsedCandidates > 0) {
    analysisStatus =
      analyzedCandidates === parsedCandidates
        ? 'completed'
        : analyzedCandidates > 0
          ? 'partially_completed'
          : failedAnalysisCandidates > 0
            ? 'failed'
            : 'pending';
  } else if (failedCandidates > 0) {
    analysisStatus = 'failed';
  }

  await Screening.updateOne(
    { _id: screeningId },
    {
      $set: {
        totalCandidates,
        parsedCandidates,
        failedCandidates,
        analyzedCandidates,
        failedAnalysisCandidates,
        status,
        analysisStatus,
      },
    },
  );

  return {
    totalCandidates,
    parsedCandidates,
    failedCandidates,
    analyzedCandidates,
    failedAnalysisCandidates,
    status,
    analysisStatus,
  };
}

async function processOneApplication({
  application,
  organization,
  actor,
}) {
  const candidate = application.candidate;
  const screening = application.screening;

  if (!candidate || !screening) {
    return {
      applicationId: application._id.toString(),
      success: false,
      stage: 'promotion',
      error: 'Candidate or screening link is missing.',
    };
  }

  application.status = 'screening';
  application.lastError = '';
  await application.save();

  // Parsing can be safely skipped when it already succeeded.
  if (candidate.parsingStatus !== 'parsed') {
    try {
      const resumeText = await extractResumeText(asResumeFile(application));

      candidate.extractedText = resumeText;
      candidate.parsingStatus = 'parsed';
      candidate.parsingError = '';
      candidate.analysisStatus = 'pending';
      candidate.analysisError = '';

      application.parsingStatus = 'parsed';
      application.analysisStatus = 'pending';
      application.lastError = '';

      await Promise.all([candidate.save(), application.save()]);
    } catch (error) {
      const message = error?.message || 'Resume parsing failed';

      candidate.parsingStatus = 'failed';
      candidate.parsingError = message;
      candidate.analysisStatus = 'failed';
      candidate.analysisError =
        'AI analysis was skipped because resume parsing failed.';

      application.parsingStatus = 'failed';
      application.analysisStatus = 'failed';
      application.status = 'failed';
      application.lastError = message;

      await Promise.all([candidate.save(), application.save()]);

      await recordCandidateEvent({
        organization,
        screening: screening._id,
        candidate: candidate._id,
        actor,
        type: 'analysis_failed',
        title: 'Website resume processing failed',
        description: message,
        metadata: {
          source: application.source,
          stage: 'resume_parsing',
          websiteApplicationId: application._id.toString(),
          externalApplicationId: application.externalApplicationId,
          externalJobId: application.externalJobId,
        },
        occurredAt: new Date(),
      });

      return {
        applicationId: application._id.toString(),
        candidateId: candidate._id.toString(),
        screeningId: screening._id.toString(),
        success: false,
        stage: 'resume_parsing',
        error: message,
      };
    }
  } else {
    application.parsingStatus = 'parsed';
  }

  candidate.analysisStatus = 'processing';
  candidate.analysisError = '';
  candidate.aiProvider = '';
  candidate.aiModel = '';
  candidate.aiResponseId = '';

  application.analysisStatus = 'processing';
  application.status = 'screening';
  application.lastError = '';

  await Promise.all([candidate.save(), application.save()]);

  try {
    const result = await analyzeResume({
      resumeText: candidate.extractedText,
      jobDescription: screening.jobDescription,
    });

    const extractedContact = extractContactDetails(candidate.extractedText);
    const aiAnalysis = result.analysis || {};

    // The WordPress application form is authoritative for applicant contact
    // details. Resume extraction/AI remain useful fallbacks.
    candidate.analysis = {
      ...aiAnalysis,
      candidateName:
        application.fullName ||
        aiAnalysis.candidateName ||
        candidate.originalFileName,
      email:
        application.email ||
        extractedContact.email ||
        aiAnalysis.email ||
        '',
      phone:
        application.phone ||
        extractedContact.phone ||
        aiAnalysis.phone ||
        '',
    };

    candidate.analysisStatus = 'completed';
    candidate.analysisError = '';
    candidate.analyzedAt = new Date();
    candidate.aiProvider = result.provider;
    candidate.aiModel = result.model;
    candidate.aiResponseId = result.responseId;

    application.analysisStatus = 'completed';
    application.status = 'analyzed';
    application.lastError = '';

    await Promise.all([candidate.save(), application.save()]);

    await recordCandidateEvent({
      organization,
      screening: screening._id,
      candidate: candidate._id,
      actor,
      type: 'analysis_completed',
      title: 'AI resume analysis completed',
      description: `${application.fullName} was analyzed against the mapped TalentLens job description.`,
      metadata: {
        source: application.source,
        websiteApplicationId: application._id.toString(),
        externalApplicationId: application.externalApplicationId,
        externalJobId: application.externalJobId,
        matchScore: candidate.analysis?.matchScore ?? null,
        recommendation: candidate.analysis?.recommendation || '',
        aiProvider: candidate.aiProvider,
        aiModel: candidate.aiModel,
      },
      occurredAt: candidate.analyzedAt,
    });

    return {
      applicationId: application._id.toString(),
      candidateId: candidate._id.toString(),
      screeningId: screening._id.toString(),
      success: true,
      stage: 'completed',
      matchScore: candidate.analysis?.matchScore ?? null,
      recommendation: candidate.analysis?.recommendation || '',
    };
  } catch (error) {
    const message = error?.message || 'AI analysis failed';

    candidate.analysisStatus = 'failed';
    candidate.analysisError = message;

    application.analysisStatus = 'failed';
    application.status = 'failed';
    application.lastError = message;

    await Promise.all([candidate.save(), application.save()]);

    await recordCandidateEvent({
      organization,
      screening: screening._id,
      candidate: candidate._id,
      actor,
      type: 'analysis_failed',
      title: 'AI resume analysis failed',
      description: message,
      metadata: {
        source: application.source,
        stage: 'ai_analysis',
        websiteApplicationId: application._id.toString(),
        externalApplicationId: application.externalApplicationId,
        externalJobId: application.externalJobId,
      },
      occurredAt: new Date(),
    });

    return {
      applicationId: application._id.toString(),
      candidateId: candidate._id.toString(),
      screeningId: screening._id.toString(),
      success: false,
      stage: 'ai_analysis',
      error: message,
    };
  }
}

export async function processPromotedWebsiteApplications({
  organization,
  actor,
  applicationIds,
}) {
  const applications = await WebsiteApplication.find({
    _id: { $in: applicationIds },
    organization,
  })
    .populate('candidate')
    .populate('screening');

  const processable = applications.filter(
    (application) =>
      application.candidate &&
      application.screening &&
      ['selected_for_screening', 'screening'].includes(application.status),
  );

  if (!processable.length) {
    return {
      results: [],
      screeningSummaries: [],
      completedCount: 0,
      failedCount: 0,
    };
  }

  const results = await mapWithConcurrency(
    processable,
    env.aiConcurrency,
    (application) =>
      processOneApplication({
        application,
        organization,
        actor,
      }),
  );

  const screeningIds = [
    ...new Set(
      processable
        .map((application) => application.screening?._id?.toString())
        .filter(Boolean),
    ),
  ];

  const screeningSummaries = [];
  for (const screeningId of screeningIds) {
    screeningSummaries.push({
      screeningId,
      ...(await recalculateScreening(screeningId)),
    });
  }

  return {
    results,
    screeningSummaries,
    completedCount: results.filter((result) => result.success).length,
    failedCount: results.filter((result) => !result.success).length,
  };
}
