import { randomUUID } from 'node:crypto';
import express from 'express';
import type { Express } from 'express';
import { scoreBatch } from './model/scorer';
import type { ModelArtifact, TriageInputTask } from './model/types';
import type { OtlpExporter } from './telemetry/otlp';
import { shouldSample } from './telemetry/sampler';
import { parseBaggage } from './telemetry/baggage';
import { log } from './logger';

/** Inference HTTP service. Same `/triage` contract as the backend. */
export function createApp(model: ModelArtifact, otlp?: OtlpExporter): Express {
  const app = express();

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-trace-id');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'x-trace-id');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json());
  const sampleRate = Number(process.env.OTEL_SAMPLE_RATE ?? '1');
  app.use((req, res, next) => {
    const parent = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(req.header('traceparent') ?? '');
    const traceId = parent ? parent[1] : (req.header('x-trace-id') ?? randomUUID());
    const parentSpanId = parent ? parent[2] : undefined;
    const sampled = parent ? (parseInt(parent[3], 16) & 1) === 1 : shouldSample(traceId, sampleRate);
    const baggage = parseBaggage(req.header('baggage'));
    res.setHeader('x-trace-id', traceId);
    const startMs = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - startMs;
      log('info', 'request', { traceId, path: req.path, status: res.statusCode, durationMs });
      if (otlp && sampled) {
        otlp.export({
          traceId,
          parentSpanId,
          name: `${req.method} ${req.path}`,
          kind: 2,
          startEpochMs: startMs,
          durationMs,
          status: res.statusCode >= 500 ? 'error' : 'ok',
          attributes: {
            'http.method': req.method,
            'http.route': req.path,
            'http.status_code': res.statusCode,
            ...Object.fromEntries(Object.entries(baggage).map(([k, v]) => [`baggage.${k}`, v])),
          },
        });
      }
    });
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', model: model.version });
  });

  app.post('/triage', (req, res) => {
    const body = req.body as { tasks?: unknown };
    if (!Array.isArray(body.tasks)) {
      res.status(400).json({ error: 'tasks[] required' });
      return;
    }
    res.json({ suggestions: scoreBatch(model, body.tasks as TriageInputTask[]) });
  });

  return app;
}
