import crypto from 'crypto';
import { User } from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function serializeUser(user) {
  return user.toSafeObject();
}

async function assertAdminSafety(targetUser, currentUser, changes = {}) {
  const removesAdmin = targetUser.role === ROLES.ADMIN && (
    changes.role && changes.role !== ROLES.ADMIN
    || changes.isActive === false
    || changes.delete === true
  );
  if (!removesAdmin) return;

  const remainingAdmins = await User.countDocuments({
    organization: currentUser.organization,
    role: ROLES.ADMIN,
    isActive: true,
    _id: { $ne: targetUser._id },
  });
  if (remainingAdmins < 1) {
    throw new AppError('Your organization must keep at least one active admin', 400);
  }
}

export const listOrganizationUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ organization: req.user.organization })
    .sort({ createdAt: 1 });
  res.json({ success: true, users: users.map(serializeUser) });
});

export const createOrganizationUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const exists = await User.exists({ email });
  if (exists) throw new AppError('An account with this email already exists', 409);

  const user = await User.create({
    name,
    email,
    password,
    role,
    organization: req.user.organization,
    isActive: true,
    mustChangePassword: true,
    invitedBy: req.user._id,
    invitationSentAt: new Date(),
  });

  res.status(201).json({ success: true, user: serializeUser(user) });
});

export const updateOrganizationUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.userId,
    organization: req.user.organization,
  });
  if (!user) throw new AppError('Team member not found', 404);

  if (user._id.equals(req.user._id) && req.body.isActive === false) {
    throw new AppError('You cannot deactivate your own account', 400);
  }
  if (user._id.equals(req.user._id) && req.body.role && req.body.role !== ROLES.ADMIN) {
    throw new AppError('You cannot remove your own admin role', 400);
  }

  await assertAdminSafety(user, req.user, req.body);

  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.role !== undefined) user.role = req.body.role;
  if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
  await user.save();

  res.json({ success: true, user: serializeUser(user) });
});

export const resendOrganizationInvitation = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.userId,
    organization: req.user.organization,
  });
  if (!user) throw new AppError('Team member not found', 404);
  if (user._id.equals(req.user._id)) throw new AppError('You cannot reset your own invitation', 400);

  const temporaryPassword = `Ri!${crypto.randomBytes(6).toString('base64url')}`;
  user.password = temporaryPassword;
  user.mustChangePassword = true;
  user.isActive = true;
  user.invitationSentAt = new Date();
  await user.save();

  res.json({
    success: true,
    user: serializeUser(user),
    temporaryPassword,
    message: 'Temporary credentials regenerated. Share them securely with the team member.',
  });
});

export const deleteOrganizationUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.userId,
    organization: req.user.organization,
  });
  if (!user) throw new AppError('Team member not found', 404);
  if (user._id.equals(req.user._id)) throw new AppError('You cannot remove your own account', 400);

  await assertAdminSafety(user, req.user, { delete: true });
  await user.deleteOne();
  res.json({ success: true, message: 'Team member removed' });
});
