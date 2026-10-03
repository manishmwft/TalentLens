import { api } from './api.js';

export async function getNotifications({ unread = false, limit = 20 } = {}) {
  const { data } = await api.get('/notifications', { params: { unread, limit } });
  return data;
}

export async function markNotificationRead(notificationId) {
  const { data } = await api.patch(`/notifications/${notificationId}/read`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.patch('/notifications/read-all');
  return data;
}
