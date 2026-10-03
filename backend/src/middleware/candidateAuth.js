import { CandidateAccount } from '../models/CandidateAccount.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireCandidateAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Candidate authentication required', 401);
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new AppError('Invalid or expired candidate session', 401);
  }

  if (payload.accountType !== 'candidate') {
    throw new AppError('This session is not a candidate session', 403);
  }

  const account = await CandidateAccount.findById(payload.sub);

  if (!account) {
    throw new AppError('Candidate account no longer exists', 401);
  }

  if (account.status === 'deactivated') {
    throw new AppError('This candidate account has been deactivated', 403);
  }

  if (account.status === 'locked') {
    if (account.lockedUntil && account.lockedUntil > new Date()) {
      throw new AppError('This candidate account is temporarily locked', 423);
    }

    account.status = account.mustChangePassword ? 'invited' : 'active';
    account.failedLoginAttempts = 0;
    account.lockedUntil = null;
    await account.save();
  }

  req.candidateAccount = account;
  next();
});

export const requireCandidatePasswordChanged = asyncHandler(async (req, _res, next) => {
  if (req.candidateAccount.mustChangePassword) {
    throw new AppError('You must change your temporary password before continuing', 403);
  }

  next();
});
