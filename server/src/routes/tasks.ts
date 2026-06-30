import { Router } from 'express';
import { applyMove } from '../domain/move';
import type { MoveTaskInput, TaskStatus } from '../domain/types';
import type { RealtimeHub } from '../realtime/hub';
import type { TaskStore } from '../store/TaskStore';
import { redactForRole } from '../domain/risk';
import { ownsTask, visibleTasks } from '../domain/ownership';

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

  router.get('/', async (req, res) => {
    const principal = req.principal;
    const role = principal?.role ?? 'customer';
    // Ownership first (customers only see their own shipments), then risk redaction.
    const visible = visibleTasks(await store.read(), principal);
    res.json(visible.map((task) => redactForRole(task, role)));
  });

  router.patch('/:id/move', async (req, res) => {
    const input = parseMove(req.body);
    if (!input) {
      res.status(400).json({ error: 'invalid move payload' });
      return;
    }
    const id = req.params.id;
    const current = await store.read();
    const target = current.find((task) => task.id === id);
    if (!target) {
      res.status(404).json({ error: 'task not found' });
      return;
    }
    // A customer may only move shipments they own; staff may move any.
    if (!ownsTask(target, req.principal)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    const tasks = await store.mutate((tasksNow) => applyMove(tasksNow, id, input.toStatus, input.toIndex));
    hub.broadcast({ type: 'task-updated', taskId: id, at: new Date().toISOString() });
    const role = req.principal?.role ?? 'customer';
    res.json(visibleTasks(tasks, req.principal).map((task) => redactForRole(task, role)));
  });

  return router;
}
