import { appBaggage, getAuthToken, refreshAccessToken, useAuthStore } from '@/features/auth/authStore';
import type { HttpAuth, TasksDataSource } from './dataSource';
import { createHttpDataSource, createMockDataSource } from './dataSource';
import { createAiTriageDataSource } from './aiTriageDataSource';
import { createHttpTriageService, createLocalTriageService } from '../ai/triageService';

function resolveDataSource(): TasksDataSource {
  const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
  const seedCount = Number(import.meta.env.VITE_SEED_COUNT) || undefined;
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
  const auth: HttpAuth = {
    getAuthToken,
    onAuthError: () => useAuthStore.getState().clearToken(),
    refreshAuth: () => refreshAccessToken(apiBase),
    getBaggage: appBaggage,
  };

  const base: TasksDataSource = useMock
    ? createMockDataSource({ latencyMs: 350, seedCount })
    : createHttpDataSource(apiBase, auth);

  if (import.meta.env.VITE_AI_TRIAGE === 'false') {
    return base;
  }

  const triageUrl = import.meta.env.VITE_TRIAGE_URL;
  const service = triageUrl ? createHttpTriageService(triageUrl, undefined, auth) : createLocalTriageService();
  return createAiTriageDataSource(base, service);
}

export const tasksDataSource: TasksDataSource = resolveDataSource();
