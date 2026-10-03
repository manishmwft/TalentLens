import { Candidate } from '../models/Candidate.js';
import { CandidateEvent } from '../models/CandidateEvent.js';
import { HiringDecision } from '../models/HiringDecision.js';
import { Interview } from '../models/Interview.js';
import { Screening } from '../models/Screening.js';
import { recordCandidateEvent, serializeCandidateEvent } from '../services/candidateTimelineService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const decisionWorkflowMap = {
  move_forward: 'shortlisted',
  hold: 'reviewing',
  reject: 'rejected',
  offer: 'offer',
  hired: 'hired',
};

async function findCandidateContext(req) {
  const screening = await Screening.findOne({
    _id: req.params.screeningId,
    organization: req.user.organization,
  });

  if (!screening) throw new AppError('Screening not found', 404);

  const candidate = await Candidate.findOne({
    _id: req.params.candidateId,
    screening: screening._id,
  });

  if (!candidate) throw new AppError('Candidate not found', 404);

  return { screening, candidate };
}

function serializeDecision(decision) {
  if (!decision) return null;
  return {
    id: decision._id.toString(),
    decision: decision.decision,
    reason: decision.reason,
    notes: decision.notes || '',
    previousWorkflowStatus: decision.previousWorkflowStatus || '',
    resultingWorkflowStatus: decision.resultingWorkflowStatus || '',
    interviewId: decision.interview?._id?.toString?.() || decision.interview?.toString?.() || null,
    decidedBy: {
      id: decision.decidedBy?._id?.toString?.() || decision.decidedBy?.toString?.() || null,
      name: decision.decidedBy?.name || decision.decidedByName,
      role: decision.decidedBy?.role || decision.decidedByRole,
    },
    decidedAt: decision.decidedAt,
  };
}

function syntheticEvent({ type, title, description = '', occurredAt, metadata = {}, interviewId = null }) {
  return {
    id: `synthetic-${type}-${new Date(occurredAt).getTime()}-${interviewId || ''}`,
    type,
    title,
    description,
    actor: { id: null, name: 'System', role: 'system' },
    metadata,
    interviewId,
    occurredAt,
    source: 'derived',
  };
}

async function buildTimeline({ screening, candidate }) {
  const [storedEvents, interviews, decisions] = await Promise.all([
    CandidateEvent.find({ candidate: candidate._id })
      .populate('actor', 'name role')
      .sort({ occurredAt: -1 })
      .lean(),
    Interview.find({ candidate: candidate._id, organization: screening.organization })
      .select('scheduledAt status completedAt createdAt updatedAt interviewer finalFeedback')
      .populate('interviewer', 'name role')
      .sort({ createdAt: 1 })
      .lean(),
    HiringDecision.find({ candidate: candidate._id, organization: screening.organization })
      .populate('decidedBy', 'name role')
      .sort({ decidedAt: -1 })
      .lean(),
  ]);

  const events = storedEvents.map(serializeCandidateEvent);
  const existingTypes = new Set(events.map((event) => event.type));

  if (!existingTypes.has('resume_uploaded')) {
    events.push(syntheticEvent({
      type: 'resume_uploaded',
      title: 'Resume uploaded',
      description: candidate.originalFileName,
      occurredAt: candidate.createdAt,
      metadata: { fileName: candidate.originalFileName },
    }));
  }

  if (candidate.analysisStatus === 'completed' && candidate.analyzedAt && !existingTypes.has('analysis_completed')) {
    events.push(syntheticEvent({
      type: 'analysis_completed',
      title: 'AI analysis completed',
      description: `Match score: ${candidate.analysis?.matchScore ?? 0}%`,
      occurredAt: candidate.analyzedAt,
      metadata: { matchScore: candidate.analysis?.matchScore ?? null },
    }));
  }

  if (candidate.analysisStatus === 'failed' && !existingTypes.has('analysis_failed')) {
    events.push(syntheticEvent({
      type: 'analysis_failed',
      title: 'AI analysis failed',
      description: candidate.analysisError || 'Analysis could not be completed.',
      occurredAt: candidate.updatedAt,
    }));
  }

  for (const interview of interviews) {
    const interviewId = interview._id.toString();
    events.push(syntheticEvent({
      type: 'interview_scheduled',
      title: 'Interview scheduled',
      description: interview.interviewer?.name
        ? `Assigned to ${interview.interviewer.name}`
        : 'Interview assignment created',
      occurredAt: interview.createdAt,
      interviewId,
      metadata: { scheduledAt: interview.scheduledAt, interviewerName: interview.interviewer?.name || '' },
    }));

    if (interview.status === 'in_progress') {
      events.push(syntheticEvent({
        type: 'interview_started',
        title: 'Interview started',
        occurredAt: interview.updatedAt,
        interviewId,
      }));
    }

    if (interview.finalFeedback?.submittedAt) {
      events.push(syntheticEvent({
        type: 'feedback_submitted',
        title: 'Final interview feedback submitted',
        description: interview.finalFeedback.recommendation
          ? `Recommendation: ${String(interview.finalFeedback.recommendation).replaceAll('_', ' ')}`
          : '',
        occurredAt: interview.finalFeedback.submittedAt,
        interviewId,
        metadata: {
          overallScore: interview.finalFeedback.overallScore || 0,
          recommendation: interview.finalFeedback.recommendation || '',
        },
      }));
    }

    if (interview.status === 'completed' && interview.completedAt) {
      events.push(syntheticEvent({
        type: 'interview_completed',
        title: 'Interview completed',
        occurredAt: interview.completedAt,
        interviewId,
      }));
    }

    if (interview.status === 'cancelled') {
      events.push(syntheticEvent({
        type: 'interview_cancelled',
        title: 'Interview cancelled',
        occurredAt: interview.updatedAt,
        interviewId,
      }));
    }
  }

  for (const decision of decisions) {
    if (!events.some((event) => event.type === 'decision_recorded' && event.metadata?.decisionId === decision._id.toString())) {
      events.push({
        id: `decision-${decision._id}`,
        type: 'decision_recorded',
        title: `Decision: ${decision.decision.replaceAll('_', ' ')}`,
        description: decision.reason,
        actor: {
          id: decision.decidedBy?._id?.toString?.() || decision.decidedBy?.toString?.() || null,
          name: decision.decidedBy?.name || decision.decidedByName,
          role: decision.decidedBy?.role || decision.decidedByRole,
        },
        metadata: { decisionId: decision._id.toString(), decision: decision.decision },
        interviewId: decision.interview?.toString?.() || null,
        occurredAt: decision.decidedAt,
        source: 'decision',
      });
    }
  }

  events.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

  return {
    events,
    decisions: decisions.map(serializeDecision),
    latestDecision: decisions.length ? serializeDecision(decisions[0]) : null,
  };
}

export const getCandidateTimeline = asyncHandler(async (req, res) => {
  const { screening, candidate } = await findCandidateContext(req);
  const timeline = await buildTimeline({ screening, candidate });

  res.json({
    success: true,
    candidate: {
      id: candidate._id.toString(),
      name: candidate.analysis?.candidateName || candidate.originalFileName,
      workflowStatus: candidate.workflowStatus,
    },
    ...timeline,
  });
});

export const createHiringDecision = asyncHandler(async (req, res) => {
  const { screening, candidate } = await findCandidateContext(req);

  let interview = null;
  if (req.body.interviewId) {
    interview = await Interview.findOne({
      _id: req.body.interviewId,
      candidate: candidate._id,
      organization: req.user.organization,
    });
    if (!interview) throw new AppError('Interview not found for this candidate', 404);
  } else {
    interview = await Interview.findOne({ candidate: candidate._id, organization: req.user.organization })
      .sort({ completedAt: -1, createdAt: -1 });
  }

  const previousWorkflowStatus = candidate.workflowStatus || 'new';
  const resultingWorkflowStatus = decisionWorkflowMap[req.body.decision];

  const decision = await HiringDecision.create({
    organization: req.user.organization,
    screening: screening._id,
    candidate: candidate._id,
    interview: interview?._id || null,
    decision: req.body.decision,
    reason: req.body.reason,
    notes: req.body.notes || '',
    previousWorkflowStatus,
    resultingWorkflowStatus,
    decidedBy: req.user._id,
    decidedByName: req.user.name,
    decidedByRole: req.user.role,
    decidedAt: new Date(),
  });

  candidate.workflowStatus = resultingWorkflowStatus;
  await candidate.save();

  await recordCandidateEvent({
    organization: req.user.organization,
    screening: screening._id,
    candidate: candidate._id,
    interview: interview?._id || null,
    actor: req.user,
    type: 'decision_recorded',
    title: `Hiring decision: ${req.body.decision.replaceAll('_', ' ')}`,
    description: req.body.reason,
    metadata: {
      decisionId: decision._id.toString(),
      decision: req.body.decision,
      previousWorkflowStatus,
      resultingWorkflowStatus,
    },
  });

  const populatedDecision = await HiringDecision.findById(decision._id).populate('decidedBy', 'name role');
  const timeline = await buildTimeline({ screening, candidate });

  res.status(201).json({
    success: true,
    message: 'Hiring decision recorded',
    candidate: {
      id: candidate._id.toString(),
      workflowStatus: candidate.workflowStatus,
    },
    decision: serializeDecision(populatedDecision),
    ...timeline,
  });
});
