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

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
  detail?: string;
}

export function listAudit(filter: { actor?: string; action?: string } = {}): Promise<AuditEntry[]> {
  const params = new URLSearchParams();
  if (filter.actor) {
    params.set('actor', filter.actor);
  }
  if (filter.action) {
    params.set('action', filter.action);
  }
  const qs = params.toString();
  return client.request<AuditEntry[]>(`/audit${qs ? `?${qs}` : ''}`);
}
