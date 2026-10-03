import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const updateProfile = asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  await req.user.populate('organization', 'name slug');
  res.json({ success: true, user: req.user.toSafeObject() });
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!user || !(await user.comparePassword(req.body.currentPassword))) {
    throw new AppError('Current password is incorrect', 400);
  }
  user.password = req.body.newPassword;
  user.mustChangePassword = false;
  await user.save();
  await user.populate('organization', 'name slug');
  res.json({ success: true, user: user.toSafeObject() });
});
