import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { createTokenService } from './auth/tokenService';
import { createMemoryTokenStore } from './auth/tokenStore';
import { createMemoryAuditLog } from './audit/auditLog';
import { createMetrics } from './metrics/metrics';
import { createInMemoryUserStore } from './auth/userStore';
import type { OtlpExporter, SpanData } from './telemetry/otlp';
import { createSeedTasks } from './domain/seed';
import type { Task } from './domain/types';
import type { TaskStore } from './store/TaskStore';
import type { RealtimeEvent, RealtimeHub } from './realtime/hub';

const TOKEN = 'test-token';

function memoryStore(initial: Task[]): TaskStore {
  let tasks = initial;
  return {
    read: async () => tasks,
    mutate: async (mutator) => {
      tasks = mutator(tasks);
      return tasks;
    },
  };
}

async function setup(otlp?: OtlpExporter) {
  const events: RealtimeEvent[] = [];
  const hub: RealtimeHub = { add: () => {}, broadcast: (event) => events.push(event), size: () => 0 };
  const store = memoryStore(createSeedTasks(new Date('2025-06-01T00:00:00.000Z')));
  const tokenStore = createMemoryTokenStore();
  const metrics = createMetrics();
  metrics.gauge('shiptivitas_tokens_active_access', 'active');
  const tokens = createTokenService(tokenStore, { staticToken: TOKEN, metrics });
  const metricsText = async () => {
    metrics.set('shiptivitas_tokens_active_access', (await tokenStore.stats()).access);
    return metrics.render();
  };
  const audit = createMemoryAuditLog();
  const users = await createInMemoryUserStore([{ username: 'dispatcher', password: 'pw' }]);
  return { app: createApp({ store, hub, tokens, users, audit, otlp, metricsText }), events };
}

describe('API', () => {
  it('rejects unauthenticated requests', async () => {
    await request((await setup()).app).get('/tasks').expect(401);
  });

  it('serves tasks with a valid token', async () => {
    const res = await request((await setup()).app).get('/tasks').set('Authorization', `Bearer ${TOKEN}`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('moves a task and broadcasts the change', async () => {
    const { app, events } = await setup();
    const res = await request(app)
      .patch('/tasks/task-1/move')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ toStatus: 'complete', toIndex: 0 })
      .expect(200);
    expect(res.body.find((t: Task) => t.id === 'task-1').status).toBe('complete');
    expect(events.some((e) => e.type === 'task-updated' && e.taskId === 'task-1')).toBe(true);
  });

  it('404s an unknown task', async () => {
    await request((await setup()).app)
      .patch('/tasks/ghost/move')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ toStatus: 'complete', toIndex: 0 })
      .expect(404);
  });

  it('returns triage suggestions', async () => {
    const res = await request((await setup()).app)
      .post('/triage')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ tasks: [{ id: 'task-1', status: 'backlog', priority: 'critical', mode: 'air', etaAt: new Date().toISOString() }] })
      .expect(200);
    expect(res.body.suggestions[0].taskId).toBe('task-1');
  });

  it('propagates the trace id and serves health', async () => {
    const res = await request((await setup()).app).get('/health').set('x-trace-id', 'trace-123').expect(200);
    expect(res.headers['x-trace-id']).toBe('trace-123');
    expect(res.body.status).toBe('ok');
  });

  it('exposes Prometheus token metrics', async () => {
    const { app } = await setup();
    expect((await request(app).get('/metrics').expect(200)).text).toContain('shiptivitas_tokens_issued_total');
    await request(app).post('/auth/login').send({ username: 'dispatcher', password: 'pw' }).expect(200);
    expect((await request(app).get('/metrics').expect(200)).text).toMatch(/shiptivitas_tokens_issued_total [1-9]/);
  });

  it('refreshes an access token and accepts it', async () => {
    const { app } = await setup();
    const login = await request(app).post('/auth/login').send({ username: 'dispatcher', password: 'pw' }).expect(200);
    const refreshed = await request(app).post('/auth/refresh').send({ refreshToken: login.body.refreshToken }).expect(200);
    await request(app).get('/tasks').set('Authorization', `Bearer ${refreshed.body.accessToken}`).expect(200);
  });

  it('rejects an invalid refresh token', async () => {
    await request((await setup()).app).post('/auth/refresh').send({ refreshToken: 'nope' }).expect(401);
  });

  it('logs in with valid credentials and returns a usable session', async () => {
    const res = await request((await setup()).app)
      .post('/auth/login')
      .send({ username: 'dispatcher', password: 'pw' })
      .expect(200);
    expect(res.body.user).toBe('dispatcher');
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('rejects invalid credentials', async () => {
    await request((await setup()).app).post('/auth/login').send({ username: 'dispatcher', password: 'wrong' }).expect(401);
  });

  it('exports a SERVER span under the inbound trace id', async () => {
    const captured: SpanData[] = [];
    const otlp: OtlpExporter = { export: (s) => captured.push(s), flush: () => {}, shutdown: async () => {} };
    const { app } = await setup(otlp);
    await request(app).get('/health').set('x-trace-id', 'trace-xyz').expect(200);
    expect(captured.some((s) => s.traceId === 'trace-xyz' && s.kind === 2)).toBe(true);
  });

  it('drops the span when the traceparent sampled flag is 00', async () => {
    const captured: SpanData[] = [];
    const otlp: OtlpExporter = { export: (sp) => captured.push(sp), flush: () => {}, shutdown: async () => {} };
    const { app } = await setup(otlp);
    await request(app).get('/health').set('traceparent', `00-${'a'.repeat(32)}-${'b'.repeat(16)}-00`).expect(200);
    expect(captured).toHaveLength(0);
  });

  it('enriches the span with baggage entries', async () => {
    const captured: SpanData[] = [];
    const otlp: OtlpExporter = { export: (sp) => captured.push(sp), flush: () => {}, shutdown: async () => {} };
    const { app } = await setup(otlp);
    await request(app)
      .get('/health')
      .set('traceparent', `00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`)
      .set('baggage', 'enduser.role=admin,deployment.environment=test')
      .expect(200);
    const span = captured.find((sp) => sp.traceId === 'a'.repeat(32));
    expect(span?.attributes['baggage.enduser.role']).toBe('admin');
    expect(span?.attributes['baggage.deployment.environment']).toBe('test');
  });

  it('links the SERVER span to the parent from a traceparent header', async () => {
    const captured: SpanData[] = [];
    const otlp: OtlpExporter = { export: (sp) => captured.push(sp), flush: () => {}, shutdown: async () => {} };
    const { app } = await setup(otlp);
    const traceparent = `00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`;
    await request(app).get('/health').set('traceparent', traceparent).expect(200);
    const span = captured.find((sp) => sp.traceId === 'a'.repeat(32));
    expect(span).toBeDefined();
    expect(span?.parentSpanId).toBe('b'.repeat(16));
  });

  it('rotates the refresh token (the rotated token works)', async () => {
    const { app } = await setup();
    const login = await request(app).post('/auth/login').send({ username: 'dispatcher', password: 'pw' }).expect(200);
    const first = await request(app).post('/auth/refresh').send({ refreshToken: login.body.refreshToken }).expect(200);
    expect(first.body.refreshToken).not.toBe(login.body.refreshToken);
    await request(app).post('/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(200);
  });

  it('revokes the session family when a refresh token is reused', async () => {
    const { app } = await setup();
    const login = await request(app).post('/auth/login').send({ username: 'dispatcher', password: 'pw' }).expect(200);
    const r0 = login.body.refreshToken;
    const first = await request(app).post('/auth/refresh').send({ refreshToken: r0 }).expect(200);
    await request(app).post('/auth/refresh').send({ refreshToken: r0 }).expect(401);
    await request(app).post('/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(401);
  });

  it('requires a token for /users', async () => {
    await request((await setup()).app).get('/users').expect(401);
  });

  it('forbids non-admins from managing users', async () => {
    const { app } = await setup();
    const login = await request(app).post('/auth/login').send({ username: 'dispatcher', password: 'pw' }).expect(200);
    await request(app).get('/users').set('Authorization', `Bearer ${login.body.accessToken}`).expect(403);
  });

  it('lets a signed-in user change their own password', async () => {
    const { app } = await setup();
    const login = await request(app).post('/auth/login').send({ username: 'dispatcher', password: 'pw' }).expect(200);
    const auth = `Bearer ${login.body.accessToken}`;
    await request(app).post('/me/password').set('Authorization', auth).send({ currentPassword: 'pw', newPassword: 'newpass1' }).expect(204);
    await request(app).post('/auth/login').send({ username: 'dispatcher', password: 'newpass1' }).expect(200);
    await request(app).post('/auth/login').send({ username: 'dispatcher', password: 'pw' }).expect(401);
  });

  it('rejects a password change with the wrong current password', async () => {
    const { app } = await setup();
    const login = await request(app).post('/auth/login').send({ username: 'dispatcher', password: 'pw' }).expect(200);
    await request(app).post('/me/password').set('Authorization', `Bearer ${login.body.accessToken}`).send({ currentPassword: 'wrong', newPassword: 'newpass1' }).expect(400);
  });

  it('requires a token to change a password', async () => {
    await request((await setup()).app).post('/me/password').send({ currentPassword: 'pw', newPassword: 'newpass1' }).expect(401);
  });

  it('lets an admin list, create, update and delete users', async () => {
    const { app } = await setup();
    const admin = `Bearer ${TOKEN}`; // static token has an admin principal
    expect(Array.isArray((await request(app).get('/users').set('Authorization', admin).expect(200)).body)).toBe(true);
    const created = await request(app).post('/users').set('Authorization', admin).send({ username: 'ops', password: 'pw', role: 'dispatcher' }).expect(201);
    expect(created.body.username).toBe('ops');
    await request(app).patch(`/users/${created.body.id}`).set('Authorization', admin).send({ role: 'admin' }).expect(200);
    await request(app).delete(`/users/${created.body.id}`).set('Authorization', admin).expect(204);
  });

  it('records admin actions in the audit log', async () => {
    const { app } = await setup();
    const admin = `Bearer ${TOKEN}`;
    await request(app).post('/users').set('Authorization', admin).send({ username: 'audited', password: 'pw' }).expect(201);
    const log = await request(app).get('/audit').set('Authorization', admin).expect(200);
    expect(log.body.some((e: { action: string; target: string }) => e.action === 'user.create' && e.target === 'audited')).toBe(true);
    const filtered = await request(app).get('/audit?action=user.create').set('Authorization', admin).expect(200);
    expect(filtered.body.every((e: { action: string }) => e.action === 'user.create')).toBe(true);
  });

  it('forbids non-admins from reading the audit log', async () => {
    const { app } = await setup();
    const login = await request(app).post('/auth/login').send({ username: 'dispatcher', password: 'pw' }).expect(200);
    await request(app).get('/audit').set('Authorization', `Bearer ${login.body.accessToken}`).expect(403);
    await request(app).get('/audit').expect(401);
  });
});
