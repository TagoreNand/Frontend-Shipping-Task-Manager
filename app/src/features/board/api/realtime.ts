/**
 * Realtime telemetry layer (L3).
 *
 * `RealtimeChannel` is the transport-agnostic contract the UI subscribes to.
 * Two implementations ship here:
 *   - `createMockRealtimeChannel` — heartbeat emitter for local/dev.
 *   - `createWebSocketRealtimeChannel` — a resilient, reconnecting WebSocket
 *     client with validated message parsing and ref-counted fan-out.
 * `resolveRealtimeChannel` selects one from the environment.
 */

import { getAuthToken } from '@/features/auth/authStore';

export type RealtimeEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'reconnecting'; attempt: number }
  | { type: 'heartbeat'; at: string }
  | { type: 'task-updated'; taskId: string; at: string };

export type RealtimeListener = (event: RealtimeEvent) => void;

export interface RealtimeChannel {
  subscribe(listener: RealtimeListener): () => void;
}

/* ------------------------------------------------------------------ mock --- */

export function createMockRealtimeChannel(intervalMs = 12_000): RealtimeChannel {
  return {
    subscribe(listener) {
      listener({ type: 'connected' });
      const id = setInterval(() => {
        listener({ type: 'heartbeat', at: new Date().toISOString() });
      }, intervalMs);
      return () => {
        clearInterval(id);
      };
    },
  };
}

/* ------------------------------------------------------------- websocket --- */

export type WebSocketFactory = (url: string, protocols?: string | string[]) => WebSocket;

export interface WebSocketChannelOptions {
  url: string;
  protocols?: string | string[];
  /** Test/SSR seam; defaults to the platform `WebSocket`. */
  socketFactory?: WebSocketFactory;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  maxRetries?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Parse + validate an inbound frame. Never trusts raw socket data. */
export function parseRealtimeMessage(data: unknown): RealtimeEvent | null {
  if (typeof data !== 'string') {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(json) || typeof json.type !== 'string') {
    return null;
  }
  const at = typeof json.at === 'string' ? json.at : new Date().toISOString();
  switch (json.type) {
    case 'task-updated':
      return typeof json.taskId === 'string' ? { type: 'task-updated', taskId: json.taskId, at } : null;
    case 'heartbeat':
      return { type: 'heartbeat', at };
    default:
      return null;
  }
}

export function createWebSocketRealtimeChannel(options: WebSocketChannelOptions): RealtimeChannel {
  const {
    url,
    protocols,
    socketFactory,
    reconnectBaseMs = 1_000,
    reconnectMaxMs = 30_000,
    maxRetries = Number.POSITIVE_INFINITY,
  } = options;

  const listeners = new Set<RealtimeListener>();
  let socket: WebSocket | null = null;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const emit = (event: RealtimeEvent): void => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const scheduleReconnect = (): void => {
    if (stopped || attempt >= maxRetries) {
      emit({ type: 'disconnected' });
      return;
    }
    attempt += 1;
    const backoff = Math.min(reconnectMaxMs, reconnectBaseMs * 2 ** (attempt - 1));
    const delay = backoff + Math.random() * backoff * 0.2;
    emit({ type: 'reconnecting', attempt });
    reconnectTimer = setTimeout(connect, delay);
  };

  function connect(): void {
    const factory: WebSocketFactory | undefined =
      socketFactory ?? (typeof WebSocket !== 'undefined' ? (u, p) => new WebSocket(u, p) : undefined);
    if (!factory) {
      emit({ type: 'disconnected' });
      return;
    }

    const ws = factory(url, protocols);
    socket = ws;

    ws.addEventListener('open', () => {
      attempt = 0;
      emit({ type: 'connected' });
    });
    ws.addEventListener('message', (event: MessageEvent) => {
      const parsed = parseRealtimeMessage(event.data);
      if (parsed) {
        emit(parsed);
      }
    });
    ws.addEventListener('close', () => {
      socket = null;
      scheduleReconnect();
    });
    ws.addEventListener('error', () => {
      ws.close();
    });
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        stopped = false;
        attempt = 0;
        connect();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stopped = true;
          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
          }
          socket?.close();
          socket = null;
        }
      };
    },
  };
}

/* -------------------------------------------------------------- resolver --- */

export function resolveRealtimeChannel(): RealtimeChannel {
  const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (useMock || !wsUrl) {
    return createMockRealtimeChannel();
  }
  const token = getAuthToken();
  const url = token ? `${wsUrl}${wsUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : wsUrl;
  return createWebSocketRealtimeChannel({ url });
}
