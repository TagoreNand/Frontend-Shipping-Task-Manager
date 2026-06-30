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

export interface RiskQueueTask {
  id: string;
  ref: string;
  title: string;
  transaction: {
    id: string;
    amount: number;
    currency: string;
    customerStatus: string;
    risk: { score: number; decision: string; reasons: string[]; reviewStatus: string };
  };
}

export const listRiskQueue = (): Promise<RiskQueueTask[]> => client.request<RiskQueueTask[]>('/risk/queue');

export const decideRisk = (taskId: string, action: 'approve' | 'block'): Promise<RiskQueueTask> =>
  client.request<RiskQueueTask>(`/risk/${taskId}`, { method: 'PATCH', body: { action } });
