import path from 'node:path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { loadModel } from './model/load';
import type { OtlpExporter, SpanData } from './telemetry/otlp';

const model = loadModel(path.join(process.cwd(), 'model.json'));
const app = createApp(model);

describe('inference API', () => {
  it('scores a batch of tasks', async () => {
    const res = await request(app)
      .post('/triage')
      .send({ tasks: [{ id: 't1', status: 'backlog', priority: 'critical', mode: 'air', etaAt: new Date().toISOString() }] })
      .expect(200);
    expect(res.body.suggestions[0].taskId).toBe('t1');
    expect(typeof res.body.suggestions[0].confidence).toBe('number');
  });

  it('scores transaction risk', async () => {
    const res = await request(app)
      .post('/risk')
      .send({ transactions: [{ id: 'x', amount: 90000, accountAgeDays: 2, mode: 'air', restrictedLane: true }] })
      .expect(200);
    expect(res.body.scores[0].id).toBe('x');
    expect(res.body.scores[0].score).toBeGreaterThan(0.8);
  });

  it('400s without a tasks array', async () => {
    await request(app).post('/triage').send({}).expect(400);
  });

  it('reports health with the model version', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.model).toBe(model.version);
  });

  it('links the span to the parent from a traceparent header', async () => {
    const captured: SpanData[] = [];
    const otlp: OtlpExporter = { export: (sp) => captured.push(sp), flush: () => {}, shutdown: async () => {} };
    const traceparent = `00-${'c'.repeat(32)}-${'d'.repeat(16)}-01`;
    await request(createApp(model, otlp)).get('/health').set('traceparent', traceparent).expect(200);
    const span = captured.find((sp) => sp.traceId === 'c'.repeat(32));
    expect(span?.parentSpanId).toBe('d'.repeat(16));
  });

  it('exports a span under the inbound trace id', async () => {
    const captured: SpanData[] = [];
    const otlp: OtlpExporter = { export: (sp) => captured.push(sp), flush: () => {}, shutdown: async () => {} };
    await request(createApp(model, otlp)).get('/health').set('x-trace-id', 'tid').expect(200);
    expect(captured.some((sp) => sp.traceId === 'tid')).toBe(true);
  });
});
