import { Router } from 'express';
import type { AuditLog } from '../audit/auditLog';
import type { UserStore } from '../auth/userStore';

/** Admin-only user management. Mount behind requireRole('admin'). */
export function usersRouter(users: UserStore, audit: AuditLog): Router {
  const router = Router();
  const actor = (req: { principal?: { username: string } }): string => req.principal?.username ?? 'unknown';

  router.get('/', async (_req, res) => {
    res.json(await users.list());
  });

  router.post('/', async (req, res) => {
    const body = req.body as { username?: unknown; password?: unknown; role?: unknown; displayName?: unknown };
    if (typeof body.username !== 'string' || typeof body.password !== 'string') {
      res.status(400).json({ error: 'username and password required' });
      return;
    }
    try {
      const user = await users.create({
        username: body.username,
        password: body.password,
        role: typeof body.role === 'string' ? body.role : undefined,
        displayName: typeof body.displayName === 'string' ? body.displayName : undefined,
      });
      await audit.record({ actor: actor(req), action: 'user.create', target: user.username, detail: `role=${user.role}` });
      res.status(201).json(user);
    } catch {
      res.status(409).json({ error: 'username taken' });
    }
  });

  router.patch('/:id', async (req, res) => {
    const body = req.body as { role?: unknown };
    if (typeof body.role !== 'string') {
      res.status(400).json({ error: 'role required' });
      return;
    }
    const user = await users.updateRole(req.params.id, body.role);
    if (!user) {
      res.status(404).json({ error: 'user not found' });
      return;
    }
    await audit.record({ actor: actor(req), action: 'user.role', target: user.username, detail: `role=${user.role}` });
    res.json(user);
  });

  router.delete('/:id', async (req, res) => {
    const removed = await users.remove(req.params.id);
    if (removed) {
      await audit.record({ actor: actor(req), action: 'user.delete', target: req.params.id });
    }
    res.status(removed ? 204 : 404).end();
  });

  return router;
}
