import { Router } from 'express';
import type { TokenService } from '../auth/tokenService';
import type { UserStore } from '../auth/userStore';

/** Self-service for the signed-in user. */
export function meRouter(tokens: TokenService, users: UserStore): Router {
  const router = Router();

  router.post('/password', async (req, res) => {
    const principal = await tokens.getPrincipal(/^Bearer (.+)$/.exec(req.header('authorization') ?? '')?.[1]);
    if (!principal) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const body = req.body as { currentPassword?: unknown; newPassword?: unknown };
    if (typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string' || body.newPassword.length < 6) {
      res.status(400).json({ error: 'currentPassword and newPassword (min 6 chars) required' });
      return;
    }
    const ok = await users.changePassword(principal.username, body.currentPassword, body.newPassword);
    if (!ok) {
      res.status(400).json({ error: 'current password is incorrect' });
      return;
    }
    res.status(204).end();
  });

  return router;
}
