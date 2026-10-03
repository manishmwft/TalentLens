import { api } from './api.js';

export async function getOrganizationUsers() {
  const { data } = await api.get('/users');
  return data.users || [];
}

export async function createOrganizationUser(payload) {
  const { data } = await api.post('/users', payload);
  return data.user;
}

export async function updateOrganizationUser(userId, payload) {
  const { data } = await api.patch(`/users/${userId}`, payload);
  return data.user;
}

export async function resendOrganizationInvitation(userId) {
  const { data } = await api.post(`/users/${userId}/resend-invitation`);
  return data;
}

export async function deleteOrganizationUser(userId) {
  const { data } = await api.delete(`/users/${userId}`);
  return data;
}
