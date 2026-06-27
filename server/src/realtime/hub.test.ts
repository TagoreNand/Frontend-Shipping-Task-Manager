import { describe, expect, it } from 'vitest';
import { createRealtimeHub } from './hub';
import type { HubSocket } from './hub';

interface FakeSocket extends HubSocket {
  sent: string[];
  closeHandlers: Array<() => void>;
}
function fakeSocket(): FakeSocket {
  const sent: string[] = [];
  const closeHandlers: Array<() => void> = [];
  return {
    OPEN: 1,
    readyState: 1,
    sent,
    closeHandlers,
    send: (data) => sent.push(data),
    on: (_event, listener) => closeHandlers.push(listener),
  };
}

describe('createRealtimeHub', () => {
  it('broadcasts to open sockets and drops closed ones', () => {
    const hub = createRealtimeHub();
    const a = fakeSocket();
    const b = fakeSocket();
    hub.add(a);
    hub.add(b);

    hub.broadcast({ type: 'heartbeat', at: 'x' });
    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(1);

    a.closeHandlers.forEach((handler) => handler());
    expect(hub.size()).toBe(1);

    hub.broadcast({ type: 'task-updated', taskId: 't1', at: 'y' });
    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(2);
  });

  it('skips sockets that are not open', () => {
    const hub = createRealtimeHub();
    const socket = fakeSocket();
    socket.readyState = 3;
    hub.add(socket);
    hub.broadcast({ type: 'heartbeat', at: 'x' });
    expect(socket.sent).toHaveLength(0);
  });
});
