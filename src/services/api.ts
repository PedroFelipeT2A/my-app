import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Interceptador para enviar token, se existir (ajuste conforme seu auth)
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;