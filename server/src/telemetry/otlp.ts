/**
 * Minimal OTLP/HTTP (JSON) trace exporter for the Node services. Spans reuse the
 * inbound `x-trace-id`, so a request correlates with the frontend span that
 * triggered it. `spansToResourceSpans` is pure; `createOtlpExporter` batches.
 */
export interface SpanData {
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startEpochMs: number;
  durationMs: number;
  status: 'ok' | 'error';
  attributes: Record<string, string | number | boolean>;
}

interface OtlpAttribute {
  key: string;
  value: { stringValue?: string; intValue?: string; boolValue?: boolean };
}

function hexId(id: string, length: number): string {
  const hex = id.replace(/[^0-9a-f]/gi, '').toLowerCase();
  return (hex + '0'.repeat(length)).slice(0, length);
}

function attribute(key: string, value: string | number | boolean): OtlpAttribute {
  if (typeof value === 'number') {
    return { key, value: { intValue: String(Math.round(value)) } };
  }
  if (typeof value === 'boolean') {
    return { key, value: { boolValue: value } };
  }
  return { key, value: { stringValue: value } };
}

const nanos = (epochMs: number): string => String(Math.round(epochMs * 1e6));

let spanCounter = 0;
function spanId(span: SpanData): string {
  if (span.spanId) {
    return hexId(span.spanId, 16);
  }
  spanCounter += 1;
  return hexId(`${span.traceId}${spanCounter.toString(16).padStart(4, '0')}`, 16);
}

export function spansToResourceSpans(spans: readonly SpanData[], resourceAttributes: Record<string, string>): unknown {
  return {
    resourceSpans: [
      {
        resource: { attributes: Object.entries(resourceAttributes).map(([k, v]) => attribute(k, v)) },
        scopeSpans: [
          {
            scope: { name: 'shiptivitas-node' },
            spans: spans.map((span) => ({
              traceId: hexId(span.traceId, 32),
              spanId: spanId(span),
              ...(span.parentSpanId ? { parentSpanId: hexId(span.parentSpanId, 16) } : {}),
              name: span.name,
              kind: span.kind,
              startTimeUnixNano: nanos(span.startEpochMs),
              endTimeUnixNano: nanos(span.startEpochMs + span.durationMs),
              attributes: Object.entries(span.attributes).map(([k, v]) => attribute(k, v)),
              status: { code: span.status === 'ok' ? 1 : 2 },
            })),
          },
        ],
      },
    ],
  };
}

export interface OtlpExporter {
  export(span: SpanData): void;
  flush(): void;
  shutdown(): Promise<void>;
}

export interface OtlpExporterOptions {
  endpoint: string;
  resourceAttributes: Record<string, string>;
  batchSize?: number;
  flushMs?: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

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

export function createOtlpExporter(options: OtlpExporterOptions): OtlpExporter {
  const { endpoint, resourceAttributes, batchSize = 25, flushMs = 5_000, headers = {}, fetchImpl } = options;
  const url = `${endpoint.replace(/\/$/, '')}/v1/traces`;
  const doFetch = fetchImpl ?? fetch;
  const buffer: SpanData[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (buffer.length === 0) {
      return;
    }
    const batch = buffer.splice(0, buffer.length);
    void doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(spansToResourceSpans(batch, resourceAttributes)),
    }).catch(() => undefined);
  }

  return {
    export(span) {
      buffer.push(span);
      if (buffer.length >= batchSize) {
        flush();
      } else if (!timer) {
        timer = setTimeout(flush, flushMs);
        if (typeof timer.unref === 'function') {
          timer.unref();
        }
      }
    },
    flush,
    async shutdown() {
      flush();
    },
  };
}
