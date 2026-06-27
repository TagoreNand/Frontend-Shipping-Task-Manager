import { createApiClient } from '@/lib/apiClient';
import { appBaggage, getAuthToken, refreshAccessToken, useAuthStore } from '../auth/authStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export interface AdminUser {
  id: string;
  username: string;
  role: string;
  displayName: string;
}

export interface NewUser {
  username: string;
  password: string;
  role: string;
  displayName?: string;
}

const client = createApiClient({
  baseUrl: API_BASE,
  getAuthToken,
  onAuthError: () => useAuthStore.getState().clearToken(),
  refreshAuth: () => refreshAccessToken(API_BASE),
  getBaggage: appBaggage,
});

export const listUsers = (): Promise<AdminUser[]> => client.request<AdminUser[]>('/users');
export const createUser = (input: NewUser): Promise<AdminUser> => client.request<AdminUser>('/users', { method: 'POST', body: input });
export const updateUserRole = (id: string, role: string): Promise<AdminUser> =>
  client.request<AdminUser>(`/users/${id}`, { method: 'PATCH', body: { role } });
export const deleteUser = (id: string): Promise<void> => client.request<void>(`/users/${id}`, { method: 'DELETE' });
