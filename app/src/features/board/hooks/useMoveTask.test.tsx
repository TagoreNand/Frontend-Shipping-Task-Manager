import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMoveTask } from './useMoveTask';
import { taskKeys } from '../api/queryKeys';
import { createSeedTasks } from '../api/seed';
import type { Task } from '../types';

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useMoveTask', () => {
  it('optimistically updates the cached task status', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
    const seed = createSeedTasks();
    client.setQueryData<Task[]>(taskKeys.lists(), seed);
    const targetId = seed[0].id;

    const { result } = renderHook(() => useMoveTask(), { wrapper: createWrapper(client) });

    act(() => {
      result.current.mutate({ input: { taskId: targetId, toStatus: 'complete', toIndex: 0 } });
    });

    await waitFor(() => {
      const data = client.getQueryData<Task[]>(taskKeys.lists());
      expect(data?.find((task) => task.id === targetId)?.status).toBe('complete');
    });
  });
});
