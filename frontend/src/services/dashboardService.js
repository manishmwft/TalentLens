import { api } from './api.js';

export async function getDashboardAnalytics(period = '90d') {
  const { data } = await api.get('/dashboard/analytics', { params: { period } });
  return data.analytics;
}
