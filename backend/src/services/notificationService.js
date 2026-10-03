import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { ROLES } from '../constants/roles.js';

export async function notifyOrganizationManagers({ organization, type, title, message, link = '', entityType = '', entityId = null, metadata = {} }) {
  const users = await User.find({
    organization,
    isActive: true,
    role: { $in: [ROLES.ADMIN, ROLES.RECRUITER, ROLES.HIRING_MANAGER] },
  }).select('_id');

  if (!users.length) return [];
  return Notification.insertMany(users.map((user) => ({
    organization,
    recipient: user._id,
    type,
    title,
    message,
    link,
    entityType,
    entityId,
    metadata,
  })));
}
