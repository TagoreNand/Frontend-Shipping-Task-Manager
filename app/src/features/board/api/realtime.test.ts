import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockRealtimeChannel,
  createWebSocketRealtimeChannel,
  parseRealtimeMessage,
} from './realtime';
import type { RealtimeEvent } from './realtime';

type Handler = (event: unknown) => void;

class FakeWebSocket {
  url: string;
  closed = false;
  handlers: Record<string, Handler[]> = {};

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, handler: Handler): void {
    (this.handlers[type] ??= []).push(handler);
  }

  removeEventListener(): void {}

  close(): void {
    this.closed = true;
    this.dispatch('close');
  }

  dispatch(type: string, event: unknown = {}): void {
    for (const handler of this.handlers[type] ?? []) {
      handler(event);
    }
  }
}

describe('parseRealtimeMessage', () => {
  it('parses a valid task-updated frame', () => {
    const event = parseRealtimeMessage(JSON.stringify({ type: 'task-updated', taskId: 't1', at: 'x' }));
    expect(event).toEqual({ type: 'task-updated', taskId: 't1', at: 'x' });
  });

  it('rejects malformed or unknown frames', () => {
    expect(parseRealtimeMessage('not json')).toBeNull();
    expect(parseRealtimeMessage(JSON.stringify({ type: 'nope' }))).toBeNull();
    expect(parseRealtimeMessage(42)).toBeNull();
  });
});

describe('realtime channels', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mock channel emits connected then heartbeats', () => {
    const events: RealtimeEvent[] = [];
    const unsubscribe = createMockRealtimeChannel(1_000).subscribe((event) => events.push(event));
    expect(events[0]).toEqual({ type: 'connected' });
    vi.advanceTimersByTime(1_000);
    expect(events.some((event) => event.type === 'heartbeat')).toBe(true);
    unsubscribe();
  });

  it('websocket channel connects, receives, and reconnects with backoff', () => {
    const sockets: FakeWebSocket[] = [];
    const factory = (url: string): WebSocket => {
      const socket = new FakeWebSocket(url);
      sockets.push(socket);
      return socket as unknown as WebSocket;
    };

    const events: RealtimeEvent[] = [];
    const channel = createWebSocketRealtimeChannel({
      url: 'ws://test',
      socketFactory: factory,
      reconnectBaseMs: 100,
      reconnectMaxMs: 1_000,
    });
    const unsubscribe = channel.subscribe((event) => events.push(event));

    expect(sockets).toHaveLength(1);
    sockets[0].dispatch('open');
    expect(events).toContainEqual({ type: 'connected' });

    sockets[0].dispatch('message', {
      data: JSON.stringify({ type: 'task-updated', taskId: 't1', at: 'x' }),
    });
    expect(events).toContainEqual({ type: 'task-updated', taskId: 't1', at: 'x' });

    // server-initiated drop → schedules a reconnect
    sockets[0].dispatch('close');
    expect(events.some((event) => event.type === 'reconnecting')).toBe(true);
    vi.advanceTimersByTime(200);
    expect(sockets).toHaveLength(2);

    unsubscribe();
    expect(sockets[1].closed).toBe(true);
  });
});
