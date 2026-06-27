export interface RealtimeEvent {
  type: 'task-updated' | 'heartbeat';
  taskId?: string;
  at: string;
}

export interface HubSocket {
  readyState: number;
  readonly OPEN: number;
  send(data: string): void;
  on(event: 'close', listener: () => void): void;
}

export interface RealtimeHub {
  add(socket: HubSocket): void;
  broadcast(event: RealtimeEvent): void;
  size(): number;
}

export function createRealtimeHub(): RealtimeHub {
  const sockets = new Set<HubSocket>();
  return {
    add(socket) {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    },
    broadcast(event) {
      const payload = JSON.stringify(event);
      for (const socket of sockets) {
        if (socket.readyState === socket.OPEN) {
          socket.send(payload);
        }
      }
    },
    size: () => sockets.size,
  };
}
