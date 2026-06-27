import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { log } from '../logger';
import { shouldSample } from '../telemetry/sampler';
import { parseBaggage } from '../telemetry/baggage';
import type { OtlpExporter } from '../telemetry/otlp';

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;
const SAMPLE_RATE = Number(process.env.OTEL_SAMPLE_RATE ?? '1');

/**
 * Parses W3C `traceparent` (with `x-trace-id` fallback), honours the sampled
 * flag (else a local head sampler), and enriches the SERVER span with `baggage`
 * entries + `tracestate`. The span is a true child of the inbound span.
 */
export function tracing(exporter?: OtlpExporter) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parent = TRACEPARENT.exec(req.header('traceparent') ?? '');
    const traceId = parent ? parent[1] : (req.header('x-trace-id') ?? randomUUID());
    const parentSpanId = parent ? parent[2] : undefined;
    const sampled = parent ? (parseInt(parent[3], 16) & 1) === 1 : shouldSample(traceId, SAMPLE_RATE);
    const baggage = parseBaggage(req.header('baggage'));
    const tracestate = req.header('tracestate');
    res.setHeader('x-trace-id', traceId);
    const startMs = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - startMs;
      log('info', 'request', { traceId, method: req.method, path: req.path, status: res.statusCode, durationMs });
      if (exporter && sampled) {
        const attributes: Record<string, string | number | boolean> = {
          'http.method': req.method,
          'http.route': req.path,
          'http.status_code': res.statusCode,
        };
        for (const [key, value] of Object.entries(baggage)) {
          attributes[`baggage.${key}`] = value;
        }
        if (tracestate) {
          attributes.tracestate = tracestate;
        }
        exporter.export({
          traceId,
          parentSpanId,
          name: `${req.method} ${req.path}`,
          kind: 2,
          startEpochMs: startMs,
          durationMs,
          status: res.statusCode >= 500 ? 'error' : 'ok',
          attributes,
        });
      }
    });
    next();
  };
}
