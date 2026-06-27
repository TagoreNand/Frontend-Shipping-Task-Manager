import { Router } from 'express';
import { scoreBatch } from '../domain/triage';
import type { Task } from '../domain/types';

interface TriageRequestTask {
  id: string;
  status: Task['status'];
  priority: Task['priority'];
  mode: Task['mode'];
  etaAt: string;
}

export function triageRouter(): Router {
  const router = Router();
  router.post('/', (req, res) => {
    const body = req.body as { tasks?: unknown };
    if (!Array.isArray(body.tasks)) {
      res.status(400).json({ error: 'tasks[] required' });
      return;
    }
    const tasks: Task[] = (body.tasks as TriageRequestTask[]).map((item) => ({
      id: item.id,
      ref: '',
      title: '',
      description: '',
      mode: item.mode,
      origin: '',
      destination: '',
      priority: item.priority,
      status: item.status,
      etaAt: item.etaAt,
      updatedAt: '',
      order: '',
    }));
    res.json({ suggestions: scoreBatch(tasks) });
  });
  return router;
}
