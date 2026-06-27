import { Router } from 'express';
import type { AuditLog } from '../audit/auditLog';

export function auditRouter(audit: AuditLog): Router {
  const router = Router();
  router.get('/', async (req, res) => {
    const query = req.query as { actor?: unknown; action?: unknown; limit?: unknown };
    const limit = typeof query.limit === 'string' ? Math.min(500, Math.max(1, Number(query.limit) || 100)) : 100;
    res.json(
      await audit.list({
        actor: typeof query.actor === 'string' && query.actor ? query.actor : undefined,
        action: typeof query.action === 'string' && query.action ? query.action : undefined,
        limit,
      }),
    );
  });
  return router;
}
