import mongoose from 'mongoose';
import { Candidate } from '../models/Candidate.js';
import { CandidateEvent } from '../models/CandidateEvent.js';
import { HiringDecision } from '../models/HiringDecision.js';
import { Interview } from '../models/Interview.js';
import { Screening } from '../models/Screening.js';
import { User } from '../models/User.js';

const PERIOD_DAYS = { '30d': 30, '90d': 90, '180d': 180 };
const WORKFLOW_STATUSES = ['new', 'reviewing', 'shortlisted', 'interview', 'offer', 'rejected', 'hired'];
const INTERVIEW_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'];
const DECISIONS = ['move_forward', 'hold', 'reject', 'offer', 'hired'];

function startDateFor(period) {
  if (period === 'all') return null;
  const days = PERIOD_DAYS[period] || PERIOD_DAYS['90d'];
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function matchFor(organizationId, startDate, dateField = 'createdAt') {
  const result = { organization: new mongoose.Types.ObjectId(organizationId) };
  if (startDate) result[dateField] = { $gte: startDate };
  return result;
}

function mapCounts(rows, values, key = '_id') {
  const source = new Map(rows.map((row) => [String(row[key]), Number(row.count || 0)]));
  return values.map((value) => ({ key: value, value: source.get(value) || 0 }));
}

function rounded(value, digits = 0) {
  if (!Number.isFinite(Number(value))) return 0;
  const multiplier = 10 ** digits;
  return Math.round(Number(value) * multiplier) / multiplier;
}

function percent(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function monthBuckets(count = 6) {
  const result = [];
  const now = new Date();
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    result.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      screenings: 0,
      candidates: 0,
      analyzed: 0,
      averageScore: 0,
    });
  }
  return result;
}

async function latestDecisionDistribution(orgId, startDate) {
  const pipeline = [
    { $match: matchFor(orgId, startDate, 'decidedAt') },
    { $sort: { decidedAt: -1 } },
    { $group: { _id: '$candidate', decision: { $first: '$decision' }, decidedAt: { $first: '$decidedAt' } } },
    { $group: { _id: '$decision', count: { $sum: 1 } } },
  ];
  return HiringDecision.aggregate(pipeline);
}

async function buildTrends(orgId) {
  const buckets = monthBuckets(6);
  const firstKey = buckets[0].key;
  const start = new Date(`${firstKey}-01T00:00:00.000Z`);
  const trendScreeningIds = await Screening.find(matchFor(orgId, start)).distinct('_id');
  const [screeningRows, candidateRows] = await Promise.all([
    Screening.aggregate([
      { $match: matchFor(orgId, start) },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, screenings: { $sum: 1 } } },
    ]),
    Candidate.aggregate([
      { $match: { screening: { $in: trendScreeningIds }, createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          candidates: { $sum: 1 },
          analyzed: { $sum: { $cond: [{ $eq: ['$analysisStatus', 'completed'] }, 1, 0] } },
          averageScore: { $avg: { $cond: [{ $eq: ['$analysisStatus', 'completed'] }, '$analysis.matchScore', null] } },
        },
      },
    ]),
  ]);
  const screenMap = new Map(screeningRows.map((row) => [row._id, row]));
  const candidateMap = new Map(candidateRows.map((row) => [row._id, row]));
  return buckets.map((bucket) => ({
    ...bucket,
    screenings: screenMap.get(bucket.key)?.screenings || 0,
    candidates: candidateMap.get(bucket.key)?.candidates || 0,
    analyzed: candidateMap.get(bucket.key)?.analyzed || 0,
    averageScore: rounded(candidateMap.get(bucket.key)?.averageScore || 0),
  }));
}

async function buildTeamPerformance(orgId, startDate) {
  const orgObjectId = new mongoose.Types.ObjectId(orgId);
  const [users, screeningRows, interviewRows, decisionRows] = await Promise.all([
    User.find({ organization: orgObjectId, isActive: true }).select('name email role avatarUrl').lean(),
    Screening.aggregate([
      { $match: matchFor(orgId, startDate) },
      { $group: { _id: '$recruiter', screenings: { $sum: 1 }, candidates: { $sum: '$totalCandidates' } } },
    ]),
    Interview.aggregate([
      { $match: matchFor(orgId, startDate) },
      {
        $group: {
          _id: '$interviewer',
          assigned: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $in: ['$status', ['scheduled', 'in_progress']] }, 1, 0] } },
          averageScore: { $avg: { $cond: [{ $gt: ['$finalFeedback.overallScore', 0] }, '$finalFeedback.overallScore', null] } },
        },
      },
    ]),
    HiringDecision.aggregate([
      { $match: matchFor(orgId, startDate, 'decidedAt') },
      { $group: { _id: '$decidedBy', decisions: { $sum: 1 } } },
    ]),
  ]);

  const screeningMap = new Map(screeningRows.map((row) => [String(row._id), row]));
  const interviewMap = new Map(interviewRows.map((row) => [String(row._id), row]));
  const decisionMap = new Map(decisionRows.map((row) => [String(row._id), row]));

  return users.map((user) => {
    const id = String(user._id);
    const screenings = screeningMap.get(id) || {};
    const interviews = interviewMap.get(id) || {};
    const decisions = decisionMap.get(id) || {};
    const activity = (screenings.screenings || 0) + (interviews.assigned || 0) + (decisions.decisions || 0);
    return {
      id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || '',
      screenings: screenings.screenings || 0,
      candidates: screenings.candidates || 0,
      assignedInterviews: interviews.assigned || 0,
      completedInterviews: interviews.completed || 0,
      pendingInterviews: interviews.pending || 0,
      averageInterviewScore: rounded(interviews.averageScore || 0),
      decisions: decisions.decisions || 0,
      activity,
    };
  }).sort((a, b) => b.activity - a.activity).slice(0, 8);
}

export async function getDashboardAnalytics({ organizationId, period = '90d' }) {
  const orgId = String(organizationId);
  const orgObjectId = new mongoose.Types.ObjectId(orgId);
  const startDate = startDateFor(period);
  const screeningMatch = matchFor(orgId, startDate);
  const screeningIds = await Screening.find(screeningMatch).distinct('_id');
  const candidateMatch = { screening: { $in: screeningIds } };
  if (startDate) candidateMatch.createdAt = { $gte: startDate };
  const interviewMatch = matchFor(orgId, startDate);

  const [
    totalScreenings,
    totalCandidates,
    activeUsers,
    candidateStatusRows,
    analysisRows,
    scoreStatsRows,
    scoreBandRows,
    interviewStatusRows,
    interviewScoreRows,
    latestDecisionRows,
    recentActivityRows,
    trends,
    teamPerformance,
  ] = await Promise.all([
    Screening.countDocuments(screeningMatch),
    Candidate.countDocuments(candidateMatch),
    User.countDocuments({ organization: orgObjectId, isActive: true }),
    Candidate.aggregate([{ $match: candidateMatch }, { $group: { _id: '$workflowStatus', count: { $sum: 1 } } }]),
    Candidate.aggregate([
      { $match: candidateMatch },
      { $group: { _id: '$analysisStatus', count: { $sum: 1 } } },
    ]),
    Candidate.aggregate([
      { $match: { ...candidateMatch, analysisStatus: 'completed' } },
      {
        $group: {
          _id: null,
          average: { $avg: '$analysis.matchScore' },
          highest: { $max: '$analysis.matchScore' },
          lowest: { $min: '$analysis.matchScore' },
          scores: { $push: '$analysis.matchScore' },
        },
      },
    ]),
    Candidate.aggregate([
      { $match: { ...candidateMatch, analysisStatus: 'completed' } },
      {
        $bucket: {
          groupBy: '$analysis.matchScore',
          boundaries: [0, 50, 70, 85, 101],
          default: 'unknown',
          output: { count: { $sum: 1 } },
        },
      },
    ]),
    Interview.aggregate([{ $match: interviewMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Interview.aggregate([
      { $match: { ...interviewMatch, 'finalFeedback.submittedAt': { $ne: null } } },
      {
        $group: {
          _id: null,
          average: { $avg: '$finalFeedback.overallScore' },
          strongHire: { $sum: { $cond: [{ $eq: ['$finalFeedback.recommendation', 'strong_hire'] }, 1, 0] } },
          hire: { $sum: { $cond: [{ $eq: ['$finalFeedback.recommendation', 'hire'] }, 1, 0] } },
          hold: { $sum: { $cond: [{ $eq: ['$finalFeedback.recommendation', 'hold'] }, 1, 0] } },
          noHire: { $sum: { $cond: [{ $eq: ['$finalFeedback.recommendation', 'no_hire'] }, 1, 0] } },
        },
      },
    ]),
    latestDecisionDistribution(orgId, startDate),
    CandidateEvent.find(matchFor(orgId, startDate, 'occurredAt'))
      .sort({ occurredAt: -1 })
      .limit(12)
      .populate('candidate', 'originalFileName analysis.candidateName workflowStatus')
      .populate('actor', 'name role')
      .lean(),
    buildTrends(orgId),
    buildTeamPerformance(orgId, startDate),
  ]);

  const candidateStatus = mapCounts(candidateStatusRows, WORKFLOW_STATUSES);
  const analysisMap = new Map(analysisRows.map((row) => [row._id, row.count]));
  const analyzed = analysisMap.get('completed') || 0;
  const analysisFailed = analysisMap.get('failed') || 0;
  const analysisAttempted = analyzed + analysisFailed;
  const statusMap = new Map(candidateStatus.map((item) => [item.key, item.value]));
  const interviewStatus = mapCounts(interviewStatusRows, INTERVIEW_STATUSES);
  const interviewMap = new Map(interviewStatus.map((item) => [item.key, item.value]));
  const decisionDistribution = mapCounts(latestDecisionRows, DECISIONS);
  const decisionMap = new Map(decisionDistribution.map((item) => [item.key, item.value]));

  const stats = scoreStatsRows[0] || {};
  const sortedScores = [...(stats.scores || [])].sort((a, b) => a - b);
  const middle = Math.floor(sortedScores.length / 2);
  const median = sortedScores.length === 0
    ? 0
    : sortedScores.length % 2
      ? sortedScores[middle]
      : (sortedScores[middle - 1] + sortedScores[middle]) / 2;
  const scoreBandMap = new Map(scoreBandRows.map((row) => [String(row._id), row.count]));
  const interviewScores = interviewScoreRows[0] || {};

  const reviewed = totalCandidates - (statusMap.get('new') || 0);
  const shortlisted = (statusMap.get('shortlisted') || 0) + (statusMap.get('interview') || 0) + (statusMap.get('offer') || 0) + (statusMap.get('hired') || 0);
  const interviewCandidates = (statusMap.get('interview') || 0) + (statusMap.get('offer') || 0) + (statusMap.get('hired') || 0);
  const offers = Math.max(statusMap.get('offer') || 0, decisionMap.get('offer') || 0);
  const hired = Math.max(statusMap.get('hired') || 0, decisionMap.get('hired') || 0);
  const rejected = statusMap.get('rejected') || 0;
  const completedInterviews = interviewMap.get('completed') || 0;

  return {
    period,
    generatedAt: new Date(),
    kpis: {
      activeUsers,
      totalScreenings,
      totalCandidates,
      analyzedCandidates: analyzed,
      analysisSuccessRate: percent(analyzed, analysisAttempted),
      reviewedCandidates: reviewed,
      shortlistedCandidates: shortlisted,
      scheduledInterviews: interviewMap.get('scheduled') || 0,
      interviewsCompleted: completedInterviews,
      offers,
      hired,
      rejected,
      averageMatchScore: rounded(stats.average || 0),
      averageInterviewScore: rounded(interviewScores.average || 0),
    },
    funnel: [
      { key: 'uploaded', label: 'Uploaded', value: totalCandidates },
      { key: 'analyzed', label: 'AI analyzed', value: analyzed },
      { key: 'reviewed', label: 'Reviewed', value: reviewed },
      { key: 'shortlisted', label: 'Shortlisted', value: shortlisted },
      { key: 'interview', label: 'Interview', value: interviewCandidates },
      { key: 'completed', label: 'Completed', value: completedInterviews },
      { key: 'offer', label: 'Offer', value: offers },
      { key: 'hired', label: 'Hired', value: hired },
    ],
    candidateStatus,
    resumeAnalytics: {
      analyzed,
      failed: analysisFailed,
      pending: (analysisMap.get('pending') || 0) + (analysisMap.get('processing') || 0),
      successRate: percent(analyzed, analysisAttempted),
      average: rounded(stats.average || 0),
      highest: rounded(stats.highest || 0),
      lowest: rounded(stats.lowest || 0),
      median: rounded(median),
      scoreBands: [
        { key: 'under_50', label: 'Under 50%', value: scoreBandMap.get('0') || 0 },
        { key: '50_69', label: '50–69%', value: scoreBandMap.get('50') || 0 },
        { key: '70_84', label: '70–84%', value: scoreBandMap.get('70') || 0 },
        { key: '85_plus', label: '85%+', value: scoreBandMap.get('85') || 0 },
      ],
    },
    interviewAnalytics: {
      status: interviewStatus,
      awaitingFeedback: interviewMap.get('in_progress') || 0,
      averageScore: rounded(interviewScores.average || 0),
      recommendations: [
        { key: 'strong_hire', value: interviewScores.strongHire || 0 },
        { key: 'hire', value: interviewScores.hire || 0 },
        { key: 'hold', value: interviewScores.hold || 0 },
        { key: 'no_hire', value: interviewScores.noHire || 0 },
      ],
    },
    hiringAnalytics: {
      decisions: decisionDistribution,
      totalDecisions: decisionDistribution.reduce((sum, item) => sum + item.value, 0),
      offerToHireRate: percent(hired, offers),
      interviewToOfferRate: percent(offers, completedInterviews),
    },
    trends,
    teamPerformance,
    recentActivity: recentActivityRows.map((event) => ({
      id: String(event._id),
      type: event.type,
      title: event.title,
      description: event.description,
      candidateId: event.candidate?._id ? String(event.candidate._id) : '',
      candidateName: event.candidate?.analysis?.candidateName || event.candidate?.originalFileName || 'Candidate',
      screeningId: String(event.screening),
      actorName: event.actor?.name || event.actorName || 'System',
      actorRole: event.actor?.role || event.actorRole || 'system',
      occurredAt: event.occurredAt,
      metadata: event.metadata || {},
    })),
  };
}
