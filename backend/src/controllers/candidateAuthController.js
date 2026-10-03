import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { CandidateAccount } from '../models/CandidateAccount.js';
import { InvitationToken } from '../models/InvitationToken.js';
import { Organization } from '../models/Organization.js';
import { INVITATION_TYPES } from '../constants/interview.js';
import { signCandidateAccessToken } from '../services/tokenService.js';
import { sendTemplateEmail } from '../services/email/emailService.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function serializeAccount(account) {
  return {
    id: account._id.toString(), organizationId: account.organization.toString(), email: account.email,
    status: account.status, mustChangePassword: account.mustChangePassword,
    emailVerifiedAt: account.emailVerifiedAt, lastLoginAt: account.lastLoginAt,
    profile: {
      fullName: account.profile?.fullName || '', phone: account.profile?.phone || '', alternatePhone: account.profile?.alternatePhone || '',
      currentCompany: account.profile?.currentCompany || '', currentRole: account.profile?.currentRole || '',
      experienceYears: account.profile?.experienceYears || 0, education: account.profile?.education || '', skills: account.profile?.skills || [],
      address: account.profile?.address || {}, timezone: account.profile?.timezone || 'Asia/Kolkata', language: account.profile?.language || 'en',
    },
  };
}

async function registerFailedAttempt(account) {
  account.failedLoginAttempts += 1;
  if (account.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) { account.status = 'locked'; account.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000); }
  await account.save();
}

export const candidateLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const account = await CandidateAccount.findOne({ email }).select('+passwordHash');
  if (!account) throw new AppError('Invalid email or password', 401);
  if (account.status === 'deactivated') throw new AppError('This candidate account has been deactivated', 403);
  if (account.status === 'locked' && account.lockedUntil && account.lockedUntil > new Date()) throw new AppError('Too many failed attempts. Try again later.', 423);
  if (account.status === 'locked') { account.status = account.mustChangePassword ? 'invited' : 'active'; account.failedLoginAttempts = 0; account.lockedUntil = null; }
  const passwordMatches = await bcrypt.compare(password, account.passwordHash);
  if (!passwordMatches) { await registerFailedAttempt(account); throw new AppError('Invalid email or password', 401); }
  account.failedLoginAttempts = 0; account.lockedUntil = null; account.lastLoginAt = new Date(); account.emailVerifiedAt ||= new Date(); await account.save();
  res.json({ success: true, token: signCandidateAccessToken(account), account: serializeAccount(account), redirectTo: account.mustChangePassword ? '/candidate/change-password' : '/candidate/dashboard' });
});

export const candidateMe = asyncHandler(async (req, res) => res.json({ success: true, account: serializeAccount(req.candidateAccount) }));

export const candidateChangePassword = asyncHandler(async (req, res) => {
  const account = await CandidateAccount.findById(req.candidateAccount._id).select('+passwordHash');
  const { currentPassword, newPassword } = req.body;
  if (!(await bcrypt.compare(currentPassword, account.passwordHash))) throw new AppError('Current password is incorrect', 400);
  account.passwordHash = await bcrypt.hash(newPassword, 12); account.mustChangePassword = false; account.status = 'active'; account.passwordChangedAt = new Date(); account.failedLoginAttempts = 0; account.lockedUntil = null; await account.save();
  res.json({ success: true, message: 'Password changed successfully', token: signCandidateAccessToken(account), account: serializeAccount(account) });
});

export const candidateForgotPassword = asyncHandler(async (req, res) => {
  const account = await CandidateAccount.findOne({ email: req.body.email });
  const response = { success: true, message: 'If an active candidate account exists, password reset instructions have been sent.' };
  if (!account || account.status === 'deactivated') return res.json(response);
  await InvitationToken.updateMany({ candidateAccount: account._id, type: INVITATION_TYPES.PASSWORD_RESET, usedAt: null, revokedAt: null }, { revokedAt: new Date() });
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await InvitationToken.create({ organization: account.organization, candidateAccount: account._id, type: INVITATION_TYPES.PASSWORD_RESET, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000), createdBy: account.createdBy, metadata: { recipientEmail: account.email, requestIp: req.ip || '', userAgent: req.get('user-agent') || '' } });
  const organization = await Organization.findById(account.organization);
  await sendTemplateEmail({ organization: organization || account.organization, candidateAccount: account._id, to: account.email, template: 'candidate_password_reset', data: { candidateName: account.profile?.fullName || 'Candidate', organizationName: organization?.name || 'TalentLens AI', brandColor: organization?.brandColor || '#6366F1', resetUrl: `${env.clientUrl}/candidate/reset-password?token=${rawToken}`, expiresIn: '60 minutes' }, createdBy: account.createdBy });
  res.json(response);
});

export const candidateResetPassword = asyncHandler(async (req, res) => {
  const tokenHash = crypto.createHash('sha256').update(req.body.token).digest('hex');
  const resetToken = await InvitationToken.findOne({ tokenHash, type: INVITATION_TYPES.PASSWORD_RESET, usedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } }).select('+tokenHash');
  if (!resetToken) throw new AppError('This reset link is invalid or has expired', 400);
  const account = await CandidateAccount.findById(resetToken.candidateAccount).select('+passwordHash');
  if (!account || account.status === 'deactivated') throw new AppError('Candidate account is unavailable', 400);
  account.passwordHash = await bcrypt.hash(req.body.newPassword, 12); account.mustChangePassword = false; account.status = 'active'; account.passwordChangedAt = new Date(); account.failedLoginAttempts = 0; account.lockedUntil = null; await account.save();
  resetToken.usedAt = new Date(); await resetToken.save();
  await InvitationToken.updateMany({ candidateAccount: account._id, type: INVITATION_TYPES.PASSWORD_RESET, usedAt: null, revokedAt: null, _id: { $ne: resetToken._id } }, { revokedAt: new Date() });
  res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
});
