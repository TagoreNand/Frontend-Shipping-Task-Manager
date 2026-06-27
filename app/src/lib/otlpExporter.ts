import { shouldSample } from './telemetry';
import type { CompletedSpan, TraceSink } from './telemetry';

/**
 * Exports tracer spans to an OTLP/HTTP (JSON) collector. `spansToOtlp` is a pure
 * converter; `createOtlpExporter` returns a batching `TraceSink` that POSTs to
 * `${endpoint}/v1/traces`. Resource attributes (service.name/version,
 * deployment.environment, …) are supplied per deployment.
 */

interface OtlpAttribute {
  key: string;
  value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean };
}
interface OtlpEvent {
  timeUnixNano: string;
  name: string;
  attributes: OtlpAttribute[];
}
interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpAttribute[];
  status: { code: number };
  events: OtlpEvent[];
}
export interface OtlpPayload {
  resourceSpans: Array<{
    resource: { attributes: OtlpAttribute[] };
    scopeSpans: Array<{ scope: { name: string }; spans: OtlpSpan[] }>;
  }>;
}

export type ResourceAttributes = Record<string, string>;

/** Parse an `OTEL_EXPORTER_OTLP_HEADERS`-style `k1=v1,k2=v2` string. */
export function parseHeaders(value: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (value ?? '').split(',')) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    }
  }
  return out;
}

function hexId(id: string, length: number): string {
  const hex = id.replace(/[^0-9a-f]/gi, '').toLowerCase();
  return (hex + '0'.repeat(length)).slice(0, length);
}

function attribute(key: string, value: unknown): OtlpAttribute {
  if (typeof value === 'string') {
    return { key, value: { stringValue: value } };
  }
  if (typeof value === 'boolean') {
    return { key, value: { boolValue: value } };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { key, value: { intValue: String(value) } }
      : { key, value: { doubleValue: value } };
  }
  return { key, value: { stringValue: JSON.stringify(value) } };
}

function toAttributes(fields: Record<string, unknown>): OtlpAttribute[] {
  return Object.entries(fields).map(([key, value]) => attribute(key, value));
}

const nanos = (epochMs: number): string => String(Math.round(epochMs * 1e6));

export function spansToOtlp(
  spans: readonly CompletedSpan[],
  resourceAttributes: ResourceAttributes,
  timeOriginMs: number = performance.timeOrigin,
): OtlpPayload {
  const otlpSpans: OtlpSpan[] = spans.map((span) => {
    const startEpochMs = timeOriginMs + span.startedAt;
    return {
      traceId: hexId(span.traceId, 32),
      spanId: hexId(span.id, 16),
      ...(span.parentSpanId ? { parentSpanId: hexId(span.parentSpanId, 16) } : {}),
      name: span.name,
      kind: span.name.startsWith('http') ? 3 : 1,
      startTimeUnixNano: nanos(startEpochMs),
      endTimeUnixNano: nanos(startEpochMs + span.durationMs),
      attributes: toAttributes(span.fields),
      status: { code: span.status === 'ok' ? 1 : 2 },
      events: span.events.map((event) => ({
        timeUnixNano: nanos(startEpochMs + event.atMs),
        name: event.name,
        attributes: toAttributes(event.fields ?? {}),
      })),
    };
  });

  return {
    resourceSpans: [
      {
        resource: { attributes: Object.entries(resourceAttributes).map(([key, value]) => attribute(key, value)) },
        scopeSpans: [{ scope: { name: 'shiptivitas-web' }, spans: otlpSpans }],
      },
    ],
  };
}

export interface OtlpExporterOptions {
  endpoint: string;
  resourceAttributes?: ResourceAttributes;
  sampleRate?: number;
  batchSize?: number;
  flushMs?: number;
  /** Extra request headers (e.g. vendor auth like `x-honeycomb-team`). */
  headers?: Record<string, string>;
  /** Test seam; defaults to `fetch` with keepalive. */
  send?: (url: string, body: string, headers: Record<string, string>) => void;
}

export function createOtlpExporter(options: OtlpExporterOptions): TraceSink {
  const {
    endpoint,
    resourceAttributes = { 'service.name': 'shiptivitas-app' },
    sampleRate = 1,
    batchSize = 20,
    flushMs = 5_000,
    headers = {},
    send,
  } = options;
  const url = `${endpoint.replace(/\/$/, '')}/v1/traces`;
  const buffer: CompletedSpan[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const post =
    send ??
    ((target: string, body: string, requestHeaders: Record<string, string>) => {
      void fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...requestHeaders },
        body,
        keepalive: true,
      }).catch(() => undefined);
    });

  function flush(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (buffer.length === 0) {
      return;
    }
    const batch = buffer.splice(0, buffer.length);
    post(url, JSON.stringify(spansToOtlp(batch, resourceAttributes)), headers);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
  }

  return (span) => {
    if (!shouldSample(span.traceId, sampleRate)) {
      return;
    }
    buffer.push(span);
    if (buffer.length >= batchSize) {
      flush();
    } else if (!timer) {
      timer = setTimeout(flush, flushMs);
    }
  };
}
