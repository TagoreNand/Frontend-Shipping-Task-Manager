import type { NextFunction, Request, Response } from 'express';
import type { TokenService } from '../auth/tokenService';

function bearer(req: Request): string | undefined {
  return /^Bearer (.+)$/.exec(req.header('authorization') ?? '')?.[1];
}

/** Requires any valid access token. */
export function bearerAuth(tokens: TokenService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void tokens
      .isValidAccess(bearer(req))
      .then((ok) => {
        if (ok) {
          next();
        } else {
          res.status(401).json({ error: 'unauthorized' });
        }
      })
      .catch(() => res.status(503).json({ error: 'auth unavailable' }));
  };
}

/** Requires a valid access token whose principal has the given role; attaches it. */
export function requireRole(tokens: TokenService, role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void tokens
      .getPrincipal(bearer(req))
      .then((principal) => {
        if (!principal) {
          res.status(401).json({ error: 'unauthorized' });
          return;
        }
        if (principal.role !== role) {
          res.status(403).json({ error: 'forbidden' });
          return;
        }
        req.principal = principal;
        next();
      })
      .catch(() => res.status(503).json({ error: 'auth unavailable' }));
  };
}
