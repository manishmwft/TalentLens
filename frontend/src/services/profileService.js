import { api } from './api.js';

export async function updateProfile(payload) {
  const { data } = await api.patch('/auth/profile', payload);
  return data.user;
}

export async function changePassword(payload) {
  const { data } = await api.patch('/auth/password', payload);
  return data.user;
}
