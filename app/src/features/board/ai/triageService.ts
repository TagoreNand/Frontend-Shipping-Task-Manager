import { createApiClient } from '@/lib/apiClient';
import type { HttpAuth } from '../api/dataSource';
import type { Task, TriageSuggestion } from '../types';
import { defaultTriageModel } from './triageModel';
import type { TriageModel } from './triageModel';

export interface TriageService {
  scoreBatch(tasks: readonly Task[], signal?: AbortSignal): Promise<TriageSuggestion[]>;
}

export function createLocalTriageService(model: TriageModel = defaultTriageModel): TriageService {
  return {
    scoreBatch(tasks) {
      const now = new Date();
      return Promise.resolve(tasks.map((task) => model.score(task, now)));
    },
  };
}

interface TriageResponseItem extends TriageSuggestion {
  taskId: string;
}

/**
 * Remote inference service with graceful fallback to the local heuristic on any
 * failure. The seam for a real ML endpoint or multi-agent router.
 */
export function createHttpTriageService(
  baseUrl: string,
  fallback: TriageService = createLocalTriageService(),
  auth: HttpAuth = {},
): TriageService {
  const client = createApiClient({
    baseUrl,
    getAuthToken: auth.getAuthToken,
    onAuthError: auth.onAuthError,
    refreshAuth: auth.refreshAuth,
    getBaggage: auth.getBaggage,
  });
  return {
    async scoreBatch(tasks, signal) {
      if (tasks.length === 0) {
        return [];
      }
      const local = await fallback.scoreBatch(tasks, signal);
      try {
        const response = await client.request<{ suggestions: TriageResponseItem[] }>('/triage', {
          method: 'POST',
          body: {
            tasks: tasks.map((task) => ({
              id: task.id,
              status: task.status,
              priority: task.priority,
              mode: task.mode,
              etaAt: task.etaAt,
            })),
          },
          signal,
        });
        const byId = new Map(response.suggestions.map((item) => [item.taskId, item]));
        return tasks.map((task, index) => {
          const remote = byId.get(task.id);
          if (!remote) {
            return local[index];
          }
          return {
            recommendedStatus: remote.recommendedStatus,
            recommendedPriority: remote.recommendedPriority,
            confidence: remote.confidence,
            rationale: remote.rationale,
          };
        });
      } catch {
        return local;
      }
    },
  };
}
