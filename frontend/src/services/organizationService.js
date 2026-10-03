import { api } from './api.js';

export async function getOrganization() {
  const { data } = await api.get('/organization');
  return data.organization;
}

export async function updateOrganization(payload) {
  const { data } = await api.patch('/organization', payload);
  return data.organization;
}
