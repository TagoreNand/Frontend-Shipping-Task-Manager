import { createServer } from 'node:http';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { createApp } from './app';
import { createTokenService } from './auth/tokenService';
import { createMemoryTokenStore } from './auth/tokenStore';
import { createMemoryAuditLog } from './audit/auditLog';
import { createMetrics } from './metrics/metrics';
import { createHttpRiskScorer, createLocalRiskScorer } from './risk/riskScorer';
import { assessTransactions } from './domain/risk';
import type { AuditLog } from './audit/auditLog';
import type { TokenStore } from './auth/tokenStore';
import { createOtlpExporter, parseHeaders } from './telemetry/otlp';
import { createInMemoryUserStore } from './auth/userStore';
import type { SeedUser, UserStore } from './auth/userStore';
import { createRealtimeHub } from './realtime/hub';
import { createJsonTaskStore } from './store/jsonStore';
import type { TaskStore } from './store/TaskStore';
import { log } from './logger';

const PORT = Number(process.env.PORT) || 4000;
const TOKEN = process.env.API_TOKEN ?? 'dev-token';
const ACCESS_TTL_MS = Number(process.env.ACCESS_TTL_MS) || 5 * 60_000;
const AUTH_USER = process.env.AUTH_USER ?? 'dispatcher';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? 'dev-password';
const ADMIN_USER = process.env.ADMIN_USER ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin-password';
const DEMO_CUSTOMERS = (process.env.DEMO_CUSTOMERS ?? 'acme,globex')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const DEMO_CUSTOMER_PASSWORD = process.env.DEMO_CUSTOMER_PASSWORD ?? 'customer-password';
const DATA_FILE = process.env.DATA_FILE ?? path.join(process.cwd(), 'data', 'tasks.json');

const seedUsers: SeedUser[] = [
  { username: AUTH_USER, password: AUTH_PASSWORD, role: 'dispatcher', displayName: 'Demo Dispatcher' },
  { username: ADMIN_USER, password: ADMIN_PASSWORD, role: 'admin', displayName: 'Administrator' },
  ...DEMO_CUSTOMERS.map((username) => ({
    username,
    password: DEMO_CUSTOMER_PASSWORD,
    role: 'customer',
    displayName: `${username.charAt(0).toUpperCase()}${username.slice(1)} Corp`,
  })),
];

async function createStores(): Promise<{ store: TaskStore; users: UserStore; audit: AuditLog }> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const { Pool } = await import('pg');
    const { createPgTaskStore } = await import('./store/pgStore');
    const { createPgUserStore } = await import('./auth/pgUserStore');
    const pool = new Pool({ connectionString: databaseUrl });
    const { createPgAuditLog } = await import('./audit/auditLog');
    log('info', 'store.postgres', {});
    return { store: await createPgTaskStore(pool), users: await createPgUserStore(pool, seedUsers), audit: await createPgAuditLog(pool) };
  }
  log('info', 'store.jsonFile', { dataFile: DATA_FILE });
  return { store: await createJsonTaskStore(DATA_FILE), users: await createInMemoryUserStore(seedUsers), audit: createMemoryAuditLog() };
}

async function createTokenStore(): Promise<TokenStore> {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const { default: IORedis } = await import('ioredis');
    const { createRedisTokenStore } = await import('./auth/redisTokenStore');
    log('info', 'tokens.redis', {});
    return createRedisTokenStore(new IORedis(redisUrl));
  }
  log('info', 'tokens.memory', {});
  return createMemoryTokenStore();
}

async function main(): Promise<void> {
  const { store, users, audit } = await createStores();
  const riskScorer = process.env.RISK_URL ? createHttpRiskScorer(process.env.RISK_URL) : createLocalRiskScorer();
  const assessed = await assessTransactions(await store.read(), riskScorer);
  await store.mutate(() => assessed);
  log('info', 'risk.assessed', { transactions: assessed.filter((t) => t.transaction?.risk).length });
  const hub = createRealtimeHub();
  const metrics = createMetrics();
  metrics.gauge('shiptivitas_tokens_active_access', 'Active access tokens');
  metrics.gauge('shiptivitas_tokens_active_refresh', 'Active refresh tokens');
  metrics.counter('shiptivitas_tokens_evicted_total', 'Expired access tokens evicted');
  const tokenStore = await createTokenStore();
  const tokens = createTokenService(tokenStore, { staticToken: TOKEN, accessTtlMs: ACCESS_TTL_MS, metrics });
  const metricsText = async (): Promise<string> => {
    const stats = await tokenStore.stats();
    metrics.set('shiptivitas_tokens_active_access', stats.access);
    metrics.set('shiptivitas_tokens_active_refresh', stats.refresh);
    return metrics.render();
  };
  const sweep = setInterval(() => {
    void tokenStore.sweepExpired(Date.now()).then((n) => {
      if (n > 0) {
        metrics.inc('shiptivitas_tokens_evicted_total', n);
      }
    });
  }, 60_000);
  if (typeof sweep.unref === 'function') {
    sweep.unref();
  }
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const otlp = otlpEndpoint
    ? createOtlpExporter({
        endpoint: otlpEndpoint,
        resourceAttributes: {
          'service.name': process.env.OTEL_SERVICE_NAME ?? 'shiptivitas-server',
          'service.version': process.env.OTEL_SERVICE_VERSION ?? '0.1.0',
          'deployment.environment': process.env.DEPLOYMENT_ENVIRONMENT ?? 'development',
        },
        headers: parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
      })
    : undefined;
  const server = createServer(createApp({ store, hub, tokens, users, audit, otlp, metricsText }));

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname !== '/realtime') {
      socket.destroy();
      return;
    }
    void tokens.isValidAccess(url.searchParams.get('token') ?? undefined).then((ok) => {
      if (!ok) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        hub.add(ws);
      });
    });
  });

  const heartbeat = setInterval(
    () => hub.broadcast({ type: 'heartbeat', at: new Date().toISOString() }),
    15_000,
  );
  server.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(sweep);
  });
  server.listen(PORT, () => log('info', 'server.listening', { port: PORT }));
}

main().catch((error: unknown) => {
  log('error', 'server.fatal', { error: String(error) });
  process.exitCode = 1;
});
