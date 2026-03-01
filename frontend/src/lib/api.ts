import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject token on every request
api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401s globally (skip auth endpoints so login errors propagate)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url = error.config?.url || '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register') ||
      url.includes('/auth/forgot-password') || url.includes('/auth/reset-password');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      const refreshToken = Cookies.get('refresh_token');
      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const resp = await axios.post('/api/auth/refresh', {}, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });
          const newToken = resp.data.access_token;
          Cookies.set('access_token', newToken, { expires: 1 });
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return api(error.config);
        } catch {
          Cookies.remove('access_token');
          Cookies.remove('refresh_token');
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      } else {
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth API ──────────────────────────────────────────────────────

export const authAPI = {
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data),
  register: (data: { username: string; email: string; password: string; full_name: string }) =>
    api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateMe: (data: any) => api.put('/auth/me', data),
  refresh: () => api.post('/auth/refresh'),
  getProfile: () => api.get('/auth/profile'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: { token: string; otp?: string; new_password: string }) =>
    api.post('/auth/reset-password', data),
  adminResetPassword: (data: { user_id: string; new_password?: string }) =>
    api.post('/auth/admin-reset-password', data),
  createInstructor: (data: { username: string; email: string; full_name: string }) =>
    api.post('/auth/create-instructor', data),
};

// ── Courses API ───────────────────────────────────────────────────

export const coursesAPI = {
  list: (params?: any) => api.get('/courses', { params }),
  get: (id: string) => api.get(`/courses/${id}`),
  create: (data: any) => api.post('/courses', data),
  update: (id: string, data: any) => api.put(`/courses/${id}`, data),
  delete: (id: string) => api.delete(`/courses/${id}`),
  enroll: (id: string) => api.post(`/courses/${id}/enroll`),
  unenroll: (id: string) => api.post(`/courses/${id}/unenroll`),
  listTopics: () => api.get('/courses/topics'),
  createTopic: (data: any) => api.post('/courses/topics', data),
  updateTopic: (id: string, data: any) => api.put(`/courses/topics/${id}`, data),
  deleteTopic: (id: string) => api.delete(`/courses/topics/${id}`),
};

// ── Materials API ─────────────────────────────────────────────────

export const materialsAPI = {
  list: (params?: any) => api.get('/materials', { params }),
  get: (id: string) => api.get(`/materials/${id}`),
  upload: (formData: FormData) =>
    api.post('/materials/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id: string, data: any) => api.put(`/materials/${id}`, data),
  delete: (id: string) => api.delete(`/materials/${id}`),
  download: (id: string) => api.get(`/materials/${id}/download`, { responseType: 'blob' }),
};

// ── Quizzes API ───────────────────────────────────────────────────

export const quizzesAPI = {
  list: (params?: any) => api.get('/quizzes', { params }),
  get: (id: string) => api.get(`/quizzes/${id}`),
  generate: (data: any) => api.post('/quizzes/generate', data),
  submitAttempt: (quizId: string, data: any) => api.post(`/quizzes/${quizId}/attempt`, data),
  listAttempts: (quizId: string, params?: any) => api.get(`/quizzes/${quizId}/attempts`, { params }),
  myAttempts: (params?: any) => api.get('/quizzes/my-attempts', { params }),
  update: (id: string, data: any) => api.put(`/quizzes/${id}`, data),
  delete: (id: string) => api.delete(`/quizzes/${id}`),
  llmStatus: () => api.get('/quizzes/llm-status'),
  approve: (id: string, action: 'approve' | 'reject') => api.put(`/quizzes/${id}/approve`, { action }),
  pending: () => api.get('/quizzes/pending'),
  getFinalExam: (courseId: string) => api.get(`/quizzes/final-exam/${courseId}`),
  editQuestion: (quizId: string, questionId: string, data: any) =>
    api.put(`/quizzes/${quizId}/questions/${questionId}`, data),
  addQuestion: (quizId: string, data: any) =>
    api.post(`/quizzes/${quizId}/questions`, data),
  deleteQuestion: (quizId: string, questionId: string) =>
    api.delete(`/quizzes/${quizId}/questions/${questionId}`),
};

// ── Roadmaps API ──────────────────────────────────────────────────

export const roadmapsAPI = {
  list: (params?: any) => api.get('/roadmaps', { params }),
  get: (id: string) => api.get(`/roadmaps/${id}`),
  generate: (data: any) => api.post('/roadmaps/generate', data),
  update: (id: string, data: any) => api.put(`/roadmaps/${id}`, data),
  delete: (id: string) => api.delete(`/roadmaps/${id}`),
  generateQuiz: (id: string) => api.post(`/roadmaps/${id}/generate-quiz`),
};

// ── Admin API ─────────────────────────────────────────────────────

export const adminAPI = {
  dashboard: () => api.get('/admin/dashboard'),
  quizAnalytics: () => api.get('/admin/quiz-analytics'),
  userActivity: (params?: any) => api.get('/admin/user-activity', { params }),
  auditLogs: (params?: any) => api.get('/admin/audit-logs', { params }),
  completionStats: () => api.get('/admin/completion-stats'),
  exportAttempts: () => api.get('/admin/export/attempts', { responseType: 'blob' }),
};

// ── Users API ─────────────────────────────────────────────────────

export const usersAPI = {
  list: (params?: any) => api.get('/users', { params }),
  get: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// ── Analytics API ─────────────────────────────────────────────────

export const analyticsAPI = {
  studentProgress: () => api.get('/analytics/student-progress'),
  leaderboard: () => api.get('/analytics/leaderboard'),
  instructorDashboard: () => api.get('/analytics/instructor-dashboard'),
};

// ── Notifications API ─────────────────────────────────────────────

export const notificationsAPI = {
  list: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
};

// ── Certificates API ──────────────────────────────────────────────

export const certificatesAPI = {
  list: () => api.get('/certificates'),
  get: (id: string) => api.get(`/certificates/${id}`),
  download: (id: string) => api.get(`/certificates/${id}/download`, { responseType: 'blob' }),
  generate: (quizAttemptId: string) => api.post('/certificates/generate', { quiz_attempt_id: quizAttemptId }),
};

// ── Chatbot API ───────────────────────────────────────────────────

export const chatbotAPI = {
  sendMessage: (message: string, sessionId?: string) =>
    api.post('/chatbot/message', { message, session_id: sessionId }),
  history: (sessionId?: string) => api.get('/chatbot/history', { params: { session_id: sessionId } }),
  sessions: () => api.get('/chatbot/sessions'),
  deleteSession: (sessionId: string) => api.delete(`/chatbot/sessions/${sessionId}`),
};

// ── License API ───────────────────────────────────────────────────

export const licenseAPI = {
  activate: (data: any) => api.post('/license/activate', data),
  status: () => api.get('/license/status'),
  deactivate: () => api.post('/license/deactivate'),
};
