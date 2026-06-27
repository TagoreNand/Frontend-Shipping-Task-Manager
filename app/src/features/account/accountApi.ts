import { createApiClient } from '@/lib/apiClient';
import { appBaggage, getAuthToken, refreshAccessToken, useAuthStore } from '../auth/authStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

const client = createApiClient({
  baseUrl: API_BASE,
  getAuthToken,
  onAuthError: () => useAuthStore.getState().clearToken(),
  refreshAuth: () => refreshAccessToken(API_BASE),
  getBaggage: appBaggage,
});

export const changePassword = (currentPassword: string, newPassword: string): Promise<void> =>
  client.request<void>('/me/password', { method: 'POST', body: { currentPassword, newPassword } });
