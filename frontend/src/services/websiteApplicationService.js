import { api } from './api.js';

export async function getWebsiteApplications(params = {}) {
  const { data } = await api.get('/website-applications', { params });
  return data;
}

export async function getWebsiteApplication(applicationId) {
  const { data } = await api.get(`/website-applications/${applicationId}`);
  return data.application;
}

export async function downloadWebsiteApplicationResume(applicationId, fallbackFilename = 'resume') {
  const response = await api.get(`/website-applications/${applicationId}/resume`, {
    responseType: 'blob',
  });

  const disposition = response.headers['content-disposition'] || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const filename = encoded
    ? decodeURIComponent(encoded)
    : plain || fallbackFilename;

  const url = window.URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export async function archiveWebsiteApplication(applicationId) {
  const { data } = await api.patch(`/website-applications/${applicationId}/archive`);
  return data.application;
}

export async function screenSelectedWebsiteApplications(applicationIds) {
  const { data } = await api.post(
    '/website-applications/screen-selected',
    { applicationIds },
    { timeout: 10 * 60 * 1000 },
  );
  return data;
}

export async function autoMapWebsiteApplications() {
  const { data } = await api.post('/website-applications/auto-map');
  return data;
}

export async function recoverFailedWebsiteScreening(applicationId) {
  const { data } = await api.post(`/website-applications/${applicationId}/recover-screening`);
  return data.screeningId;
}
