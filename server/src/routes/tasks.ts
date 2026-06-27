import { Router } from 'express';
import { applyMove } from '../domain/move';
import type { MoveTaskInput, TaskStatus } from '../domain/types';
import type { RealtimeHub } from '../realtime/hub';
import type { TaskStore } from '../store/TaskStore';

const STATUSES: readonly TaskStatus[] = ['backlog', 'in-progress', 'complete'];

function parseMove(body: unknown): MoveTaskInput | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const candidate = body as Record<string, unknown>;
  if (!STATUSES.includes(candidate.toStatus as TaskStatus)) {
    return null;
  }
  if (typeof candidate.toIndex !== 'number' || !Number.isFinite(candidate.toIndex)) {
    return null;
  }
  return { toStatus: candidate.toStatus as TaskStatus, toIndex: candidate.toIndex };
}

export function tasksRouter(store: TaskStore, hub: RealtimeHub): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await store.read());
  });

  router.patch('/:id/move', async (req, res) => {
    const input = parseMove(req.body);
    if (!input) {
      res.status(400).json({ error: 'invalid move payload' });
      return;
    }
    const id = req.params.id;
    const current = await store.read();
    if (!current.some((task) => task.id === id)) {
      res.status(404).json({ error: 'task not found' });
      return;
    }
    const tasks = await store.mutate((tasksNow) => applyMove(tasksNow, id, input.toStatus, input.toIndex));
    hub.broadcast({ type: 'task-updated', taskId: id, at: new Date().toISOString() });
    res.json(tasks);
  });

  return router;
}
