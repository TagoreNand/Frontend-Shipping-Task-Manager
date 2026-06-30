import { Router } from 'express';
import type { TokenService } from '../auth/tokenService';
import type { UserStore } from '../auth/userStore';
import { log } from '../logger';

export function authRouter(tokens: TokenService, users: UserStore): Router {
  const router = Router();

  router.post('/login', async (req, res) => {
    const body = req.body as { username?: unknown; password?: unknown };
    if (typeof body.username !== 'string' || typeof body.password !== 'string') {
      res.status(400).json({ error: 'username and password required' });
      return;
    }
    const user = await users.verify(body.username, body.password);
    if (!user) {
      res.status(401).json({ error: 'invalid credentials' });
      return;
    }
    const session = await tokens.issueSession({ username: user.username, role: user.role });
    res.json({ ...session, user: user.username, role: user.role, displayName: user.displayName });
  });

  router.post('/signup', async (req, res) => {
    const body = req.body as { username?: unknown; password?: unknown; displayName?: unknown };
    if (typeof body.username !== 'string' || typeof body.password !== 'string' || body.password.length < 6) {
      res.status(400).json({ error: 'username and password (min 6 chars) required' });
      return;
    }
    try {
      const user = await users.create({
        username: body.username,
        password: body.password,
        role: 'customer',
        displayName: typeof body.displayName === 'string' ? body.displayName : undefined,
      });
      const session = await tokens.issueSession({ username: user.username, role: user.role });
      res.status(201).json({ ...session, user: user.username, role: user.role, displayName: user.displayName });
    } catch {
      res.status(409).json({ error: 'username taken' });
    }
  });

  router.post('/refresh', async (req, res) => {
    const body = req.body as { refreshToken?: unknown };
    if (typeof body.refreshToken !== 'string') {
      res.status(400).json({ error: 'refreshToken required' });
      return;
    }
    const result = await tokens.rotateRefresh(body.refreshToken);
    if (result.status === 'reused') {
      log('warn', 'auth.refresh.reuse', { detail: 'refresh-token reuse detected; session family revoked' });
      res.status(401).json({ error: 'refresh token reuse detected; session revoked' });
      return;
    }
    if (result.status !== 'ok') {
      res.status(401).json({ error: 'invalid refresh token' });
      return;
    }
    res.json({ accessToken: result.accessToken, refreshToken: result.refreshToken, expiresInMs: result.expiresInMs, role: result.principal.role });
  });

  return router;
}
