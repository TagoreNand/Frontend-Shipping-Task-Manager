import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useBoardRealtime } from './useBoardRealtime';
import type { RealtimeChannel, RealtimeEvent, RealtimeListener } from '../api/realtime';

function makeChannel() {
  let listener: RealtimeListener | null = null;
  const channel: RealtimeChannel = {
    subscribe(next) {
      listener = next;
      return () => {
        listener = null;
      };
    },
  };
  return { channel, emit: (event: RealtimeEvent) => listener?.(event) };
}

describe('useBoardRealtime', () => {
  it('tracks connection status and invalidates on task-updated', () => {
    const { channel, emit } = makeChannel();
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const factory = () => channel;

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useBoardRealtime(factory), { wrapper });

    expect(result.current.status).toBe('connecting');

    act(() => emit({ type: 'connected' }));
    expect(result.current.status).toBe('live');

    act(() => emit({ type: 'task-updated', taskId: 't1', at: '2025-01-01T00:00:00.000Z' }));
    expect(invalidate).toHaveBeenCalled();
    expect(result.current.lastSyncAt).toBe('2025-01-01T00:00:00.000Z');

    act(() => emit({ type: 'reconnecting', attempt: 1 }));
    expect(result.current.status).toBe('reconnecting');
  });
});
