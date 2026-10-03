import { api } from './api.js';

const SCREENING_ANALYSIS_TIMEOUT_MS = 10 * 60 * 1000;

export async function createScreening({ files, jobDescription, jobDescriptionId, onUploadProgress }) {
  const formData = new FormData();
  formData.append('jobDescription', jobDescription);
  if (jobDescriptionId) formData.append('jobDescriptionId', jobDescriptionId);
  files.forEach((file) => formData.append('resumes', file));

  const { data } = await api.post('/screenings', formData, {
    timeout: SCREENING_ANALYSIS_TIMEOUT_MS,
    onUploadProgress: (event) => {
      if (!event.total || !onUploadProgress) return;
      onUploadProgress(Math.round((event.loaded * 100) / event.total));
    },
  });

  return data;
}

export async function getScreenings() {
  const { data } = await api.get('/screenings');
  return data.screenings;
}

export async function getComparisonCandidates(jobDescriptionId) {
  const { data } = await api.get('/screenings/comparison/candidates', {
    params: { jobDescriptionId },
  });
  return data.candidates || [];
}

export async function getScreening(screeningId) {
  const { data } = await api.get(`/screenings/${screeningId}`);
  return data;
}

export async function reanalyzeScreening(screeningId) {
  const { data } = await api.post(`/screenings/${screeningId}/analyze`, null, {
    timeout: SCREENING_ANALYSIS_TIMEOUT_MS,
  });
  return data;
}

function filenameFromDisposition(disposition, fallback) {
  const utf8Match = disposition?.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

function saveBlob(response, fallbackName) {
  const objectUrl = window.URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filenameFromDisposition(
    response.headers['content-disposition'],
    fallbackName,
  );
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

async function downloadFile(url, fallbackName, options = {}) {
  const requestConfig = {
    responseType: 'blob',
    timeout: SCREENING_ANALYSIS_TIMEOUT_MS,
  };

  const response = options.method === 'post'
    ? await api.post(url, options.data, requestConfig)
    : await api.get(url, requestConfig);

  saveBlob(response, fallbackName);
}

export async function downloadScreeningPdf(screeningId) {
  return downloadFile(
    `/screenings/${screeningId}/report.pdf`,
    `screening-${screeningId}.pdf`,
  );
}

export async function downloadScreeningCsv(screeningId) {
  return downloadFile(
    `/screenings/${screeningId}/candidates.csv`,
    `screening-${screeningId}-candidates.csv`,
  );
}

export async function downloadSelectedScreeningsCsv(screeningIds) {
  const date = new Date().toISOString().slice(0, 10);

  return downloadFile(
    '/screenings/export.csv',
    `screening-history-${date}.csv`,
    {
      method: 'post',
      data: { screeningIds },
    },
  );
}

export async function updateCandidateWorkflowStatus(screeningId, candidateId, workflowStatus) {
  const { data } = await api.patch(
    `/screenings/${screeningId}/candidates/${candidateId}/status`,
    { workflowStatus },
  );
  return data.candidate;
}

export async function updateCandidateNotes(screeningId, candidateId, recruiterNotes) {
  const { data } = await api.patch(
    `/screenings/${screeningId}/candidates/${candidateId}/notes`,
    { recruiterNotes },
  );
  return data.candidate;
}

export async function getCandidateTimeline(screeningId, candidateId) {
  const { data } = await api.get(
    `/screenings/${screeningId}/candidates/${candidateId}/timeline`,
  );
  return data;
}

export async function createHiringDecision(screeningId, candidateId, payload) {
  const { data } = await api.post(
    `/screenings/${screeningId}/candidates/${candidateId}/decisions`,
    payload,
  );
  return data;
}
