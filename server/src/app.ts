import express from 'express';
import type { Express } from 'express';
import { bearerAuth, requireAuth, requireRole } from './middleware/auth';
import { tracing } from './middleware/trace';
import { authRouter } from './routes/auth';
import { tasksRouter } from './routes/tasks';
import { triageRouter } from './routes/triage';
import { usersRouter } from './routes/users';
import { meRouter } from './routes/me';
import { auditRouter } from './routes/audit';
import { riskRouter } from './routes/risk';
import type { AuditLog } from './audit/auditLog';
import type { TokenService } from './auth/tokenService';
import type { RealtimeHub } from './realtime/hub';
import type { TaskStore } from './store/TaskStore';
import type { UserStore } from './auth/userStore';
import type { OtlpExporter } from './telemetry/otlp';

export interface AppDeps {
  store: TaskStore;
  hub: RealtimeHub;
  tokens: TokenService;
  users: UserStore;
  audit: AuditLog;
  otlp?: OtlpExporter;
  metricsText?: () => Promise<string>;
}

export function createApp({ store, hub, tokens, users, audit, otlp, metricsText }: AppDeps): Express {
  const app = express();

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-trace-id');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'x-trace-id');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json());
  app.use(tracing(otlp));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', connections: hub.size() });
  });

  if (metricsText) {
    app.get('/metrics', (_req, res) => {
      void metricsText().then((text) => res.type('text/plain; version=0.0.4').send(text));
    });
  }

  app.use('/auth', authRouter(tokens, users));

  const guard = bearerAuth(tokens);
  app.use('/tasks', requireAuth(tokens), tasksRouter(store, hub));
  app.use('/triage', guard, triageRouter());
  app.use('/users', requireRole(tokens, 'admin'), usersRouter(users, audit));
  app.use('/audit', requireRole(tokens, 'admin'), auditRouter(audit));
  app.use('/risk', requireRole(tokens, 'admin'), riskRouter(store, hub, audit));
  app.use('/me', meRouter(tokens, users));

  return app;
}
