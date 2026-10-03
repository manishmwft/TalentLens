import axios from 'axios';

export const candidateApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  timeout: 30000,
});

candidateApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('candidateAccessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

candidateApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('candidateAccessToken');
      localStorage.removeItem('candidateAccount');
    }
    return Promise.reject(error);
  },
);
