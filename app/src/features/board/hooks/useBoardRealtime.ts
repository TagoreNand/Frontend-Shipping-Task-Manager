import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { taskKeys } from '../api/queryKeys';
import { resolveRealtimeChannel } from '../api/realtime';
import type { RealtimeChannel } from '../api/realtime';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface RealtimeState {
  status: ConnectionStatus;
  lastSyncAt: string | null;
}

/**
 * Subscribes to the realtime telemetry channel and reconciles the query cache
 * on push events. Defaults to the env-resolved channel (mock or WebSocket);
 * inject `channelFactory` in tests.
 */
export function useBoardRealtime(
  channelFactory: () => RealtimeChannel = resolveRealtimeChannel,
): RealtimeState {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  useEffect(() => {
    const channel = channelFactory();
    const unsubscribe = channel.subscribe((event) => {
      switch (event.type) {
        case 'connected':
          setStatus('live');
          break;
        case 'reconnecting':
          setStatus('reconnecting');
          break;
        case 'disconnected':
          setStatus('offline');
          break;
        case 'heartbeat':
          setLastSyncAt(event.at);
          break;
        case 'task-updated':
          setLastSyncAt(event.at);
          void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
          break;
      }
    });
    return unsubscribe;
  }, [channelFactory, queryClient]);

  return { status, lastSyncAt };
}
