import { api } from './api.js';

export async function getJobDescriptions(params = {}) {
  const { data } = await api.get('/job-descriptions', { params });
  return data.jobDescriptions || [];
}

export async function getJobDescription(jobDescriptionId) {
  const { data } = await api.get(`/job-descriptions/${jobDescriptionId}`);
  return data.jobDescription;
}

export async function createJobDescription(payload) {
  const { data } = await api.post('/job-descriptions', payload);
  return data.jobDescription;
}

export async function updateJobDescription(jobDescriptionId, payload) {
  const { data } = await api.patch(`/job-descriptions/${jobDescriptionId}`, payload);
  return data.jobDescription;
}

export async function archiveJobDescription(jobDescriptionId) {
  const { data } = await api.delete(`/job-descriptions/${jobDescriptionId}`);
  return data.jobDescription;
}

export async function compareJobDescriptions(jobDescriptionIds) {
  const { data } = await api.post('/job-descriptions/compare', { jobDescriptionIds });
  return data.comparison;
}
