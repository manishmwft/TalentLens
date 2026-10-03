import { User } from '../models/User.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { ensureLegacyUserProvisioned } from '../services/userProvisioningService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError('Authentication required', 401);

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new AppError('User no longer exists', 401);
  if (!user.isActive) throw new AppError('This account has been deactivated', 403);
  await ensureLegacyUserProvisioned(user);
  req.user = user;
  next();
});
