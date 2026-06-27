import { createApiClient } from '@/lib/apiClient';
import type { TraceContext } from '@/lib/telemetry';
import type { MoveTaskInput, Task } from '../types';
import { moveTask as applyMove } from '../lib/group';
import { createSeedTasks } from './seed';

export interface TasksDataSource {
  getTasks(signal?: AbortSignal): Promise<Task[]>;
  moveTask(input: MoveTaskInput, ctx?: TraceContext): Promise<Task[]>;
}

export interface MockOptions {
  latencyMs?: number;
  failureRate?: number;
  seed?: Task[];
  seedCount?: number;
}

export function createMockDataSource(options: MockOptions = {}): TasksDataSource {
  const { latencyMs = 350, failureRate = 0, seed, seedCount } = options;
  let state: Task[] = seed ? seed.map((task) => ({ ...task })) : createSeedTasks(new Date(), seedCount);

  const delay = (): Promise<void> =>
    latencyMs > 0 ? new Promise((resolve) => setTimeout(resolve, latencyMs)) : Promise.resolve();

  return {
    async getTasks() {
      await delay();
      return state.map((task) => ({ ...task }));
    },
    async moveTask(input) {
      await delay();
      if (failureRate > 0 && Math.random() < failureRate) {
        throw new Error('Simulated network failure');
      }
      state = applyMove(state, input.taskId, input.toStatus, input.toIndex);
      return state.map((task) => ({ ...task }));
    },
  };
}

export interface HttpAuth {
  getAuthToken?: () => string | undefined;
  onAuthError?: () => void;
  refreshAuth?: () => Promise<string | null>;
  getBaggage?: () => Record<string, string>;
}

export function createHttpDataSource(baseUrl: string, auth: HttpAuth = {}): TasksDataSource {
  const client = createApiClient({
    baseUrl,
    getAuthToken: auth.getAuthToken,
    onAuthError: auth.onAuthError,
    refreshAuth: auth.refreshAuth,
    getBaggage: auth.getBaggage,
  });
  return {
    getTasks: (signal) => client.request<Task[]>('/tasks', { signal }),
    moveTask: (input, ctx) =>
      client.request<Task[]>(`/tasks/${input.taskId}/move`, {
        method: 'PATCH',
        body: { toStatus: input.toStatus, toIndex: input.toIndex },
        traceId: ctx?.traceId,
        parentSpanId: ctx?.spanId,
      }),
  };
}
