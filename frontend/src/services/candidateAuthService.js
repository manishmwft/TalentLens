import { candidateApi } from './candidateApi.js';

export async function candidateLogin(payload) { const { data } = await candidateApi.post('/candidate-auth/login', payload); return data; }
export async function getCandidateSession() { const { data } = await candidateApi.get('/candidate-auth/me'); return data; }
export async function changeCandidatePassword(payload) { const { data } = await candidateApi.patch('/candidate-auth/password', payload); return data; }
export async function requestCandidatePasswordReset(payload) { const { data } = await candidateApi.post('/candidate-auth/forgot-password', payload); return data; }
export async function resetCandidatePassword(payload) { const { data } = await candidateApi.post('/candidate-auth/reset-password', payload); return data; }
