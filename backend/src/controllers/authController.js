import { User } from '../models/User.js';
import { signAccessToken } from '../services/tokenService.js';
import { createOrganizationForUser, ensureLegacyUserProvisioned } from '../services/userProvisioningService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, companyName } = req.body;
  const exists = await User.exists({ email });
  if (exists) throw new AppError('An account with this email already exists', 409);

  const user = await User.create({ name, email, password });
  await createOrganizationForUser(user, companyName);
  await user.populate('organization', 'name slug');
  const token = signAccessToken(user);

  res.status(201).json({ success: true, token, user: user.toSafeObject() });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }
  if (!user.isActive) throw new AppError('This account has been deactivated', 403);

  await ensureLegacyUserProvisioned(user);
  user.lastLoginAt = new Date();
  await user.save();
  await user.populate('organization', 'name slug');

  const token = signAccessToken(user);
  res.json({ success: true, token, user: user.toSafeObject() });
});

export const me = asyncHandler(async (req, res) => {
  await req.user.populate('organization', 'name slug');
  res.json({ success: true, user: req.user.toSafeObject() });
});
