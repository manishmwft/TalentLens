import { Notification } from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

function serialize(item) {
  return {
    id: item._id.toString(),
    type: item.type,
    title: item.title,
    message: item.message,
    link: item.link,
    readAt: item.readAt,
    createdAt: item.createdAt,
  };
}

export const listNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  const filter = { organization: req.user.organization, recipient: req.user._id };
  if (req.query.unread === 'true') filter.readAt = null;
  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit),
    Notification.countDocuments({ organization: req.user.organization, recipient: req.user._id, readAt: null }),
  ]);
  res.json({ success: true, unreadCount, notifications: notifications.map(serialize) });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const item = await Notification.findOneAndUpdate(
    { _id: req.params.notificationId, organization: req.user.organization, recipient: req.user._id },
    { $set: { readAt: new Date() } },
    { new: true },
  );
  if (!item) throw new AppError('Notification not found', 404);
  res.json({ success: true, notification: serialize(item) });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { organization: req.user.organization, recipient: req.user._id, readAt: null },
    { $set: { readAt: new Date() } },
  );
  res.json({ success: true, message: 'All notifications marked as read' });
});
