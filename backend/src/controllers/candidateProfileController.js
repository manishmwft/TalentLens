import { CandidateAccount } from '../models/CandidateAccount.js';
import { Candidate } from '../models/Candidate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function serializeProfile(account, candidate) {
  return {
    fullName: account.profile?.fullName || candidate?.analysis?.candidateName || '', email: account.email,
    phone: account.profile?.phone || candidate?.analysis?.phone || '', alternatePhone: account.profile?.alternatePhone || '',
    currentCompany: account.profile?.currentCompany || '', currentRole: account.profile?.currentRole || candidate?.analysis?.currentRole || '',
    experienceYears: account.profile?.experienceYears || candidate?.analysis?.totalExperienceYears || 0,
    education: account.profile?.education || (candidate?.analysis?.education || []).join(', '),
    skills: account.profile?.skills?.length ? account.profile.skills : (candidate?.analysis?.matchedSkills || []),
    address: account.profile?.address || {}, timezone: account.profile?.timezone || 'Asia/Kolkata', language: account.profile?.language || 'en',
    resumeFileName: candidate?.originalFileName || '', updatedAt: account.updatedAt,
  };
}

async function latestCandidate(account) {
  return Candidate.findOne({ _id: { $in: account.candidates || [] }, organization: account.organization }).sort({ createdAt: -1 });
}

export const getCandidateProfile = asyncHandler(async (req, res) => {
  const account = await CandidateAccount.findById(req.candidateAccount._id);
  const candidate = await latestCandidate(account);
  res.json({ success: true, profile: serializeProfile(account, candidate) });
});

export const updateCandidateProfile = asyncHandler(async (req, res) => {
  const account = await CandidateAccount.findById(req.candidateAccount._id);
  account.profile = { ...(account.profile?.toObject?.() || account.profile || {}), ...req.body, address: { ...(account.profile?.address?.toObject?.() || account.profile?.address || {}), ...(req.body.address || {}) } };
  await account.save();
  const candidate = await latestCandidate(account);
  res.json({ success: true, message: 'Profile updated successfully', profile: serializeProfile(account, candidate) });
});
