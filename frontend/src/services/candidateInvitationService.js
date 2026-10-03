import { api } from './api.js';

export async function createAutomatedInterviewDraft(screeningId, candidateId) {
  const { data } = await api.post(
    `/automated-interviews/${screeningId}/candidates/${candidateId}/draft`,
  );
  return data;
}

export async function sendAutomatedInterviewInvitation(interviewId, payload) {
  const { data } = await api.post(
    `/automated-interviews/${interviewId}/send-invite`,
    payload,
  );
  return data;
}

// Backward compatibility for old callers.
export async function inviteCandidateToAutomatedInterview(screeningId, candidateId, payload) {
  const { data } = await api.post(
    `/automated-interviews/${screeningId}/candidates/${candidateId}/automated-invite`,
    payload,
  );
  return data;
}
