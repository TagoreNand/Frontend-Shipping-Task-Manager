import { Router } from 'express';
import { applyRiskDecision } from '../domain/risk';
import type { AuditLog } from '../audit/auditLog';
import type { RealtimeHub } from '../realtime/hub';
import type { TaskStore } from '../store/TaskStore';

/** Back-office risk review. Mount behind requireRole('admin'). */
export function riskRouter(store: TaskStore, hub: RealtimeHub, audit: AuditLog): Router {
  const router = Router();

  router.get('/queue', async (_req, res) => {
    const tasks = await store.read();
    res.json(tasks.filter((task) => task.transaction?.risk?.reviewStatus === 'pending'));
  });

  router.patch('/:taskId', async (req, res) => {
    const action = (req.body as { action?: unknown }).action;
    if (action !== 'approve' && action !== 'block') {
      res.status(400).json({ error: "action must be 'approve' or 'block'" });
      return;
    }
    const taskId = req.params.taskId;
    const target = (await store.read()).find((task) => task.id === taskId);
    if (!target?.transaction?.risk) {
      res.status(404).json({ error: 'no reviewable transaction' });
      return;
    }
    const reviewer = req.principal?.username ?? 'unknown';
    const tasks = await store.mutate((now) => applyRiskDecision(now, taskId, action, reviewer));
    await audit.record({ actor: reviewer, action: `risk.${action}`, target: target.transaction.id, detail: `task=${taskId}` });
    hub.broadcast({ type: 'task-updated', taskId, at: new Date().toISOString() });
    res.json(tasks.find((task) => task.id === taskId));
  });

  return router;
}
