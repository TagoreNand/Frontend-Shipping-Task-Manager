/**
 * Lightweight client tracing with W3C-compatible ids. Spans capture a named
 * operation, its lifecycle events, duration and status, and can declare a
 * parent span (for true parent/child linkage across the stack).
 */
export type SpanStatus = 'ok' | 'error';

export interface TraceContext {
  traceId: string;
  spanId: string;
}

export interface TraceEvent {
  name: string;
  atMs: number;
  fields?: Record<string, unknown>;
}

export interface Span {
  readonly id: string;
  readonly traceId: string;
  readonly name: string;
  event(name: string, fields?: Record<string, unknown>): void;
  end(status?: SpanStatus, fields?: Record<string, unknown>): void;
}

export interface CompletedSpan {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  startedAt: number;
  durationMs: number;
  status: SpanStatus;
  events: TraceEvent[];
  fields: Record<string, unknown>;
}

export type TraceSink = (span: CompletedSpan) => void;

export function newId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Normalise an id to a fixed-length lowercase hex string (W3C trace/span id). */
export function toHex(id: string, length: number): string {
  const hex = id.replace(/[^0-9a-f]/gi, '').toLowerCase();
  return (hex + '0'.repeat(length)).slice(0, length);
}

/** Deterministic head-based sampling: a trace id maps to a stable [0,1) fraction. */
export function shouldSample(traceId: string, rate: number): boolean {
  if (rate >= 1) {
    return true;
  }
  if (rate <= 0) {
    return false;
  }
  let hash = 2166136261;
  for (let i = 0; i < traceId.length; i += 1) {
    hash ^= traceId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296 < rate;
}

export interface StartSpanOptions {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  fields?: Record<string, unknown>;
}

export interface Tracer {
  startSpan(name: string, options?: StartSpanOptions): Span;
  subscribe(sink: TraceSink): () => void;
  recent(): CompletedSpan[];
}

export function createTracer(bufferSize = 50): Tracer {
  const sinks = new Set<TraceSink>();
  const ring: CompletedSpan[] = [];

  function emit(span: CompletedSpan): void {
    ring.push(span);
    while (ring.length > bufferSize) {
      ring.shift();
    }
    for (const sink of sinks) {
      sink(span);
    }
  }

  return {
    startSpan(name, options = {}) {
      const id = options.spanId ?? newId();
      const traceId = options.traceId ?? newId();
      const parentSpanId = options.parentSpanId;
      const startedAt = performance.now();
      const events: TraceEvent[] = [];
      const baseFields = { ...(options.fields ?? {}) };
      let ended = false;

      return {
        id,
        traceId,
        name,
        event(eventName, fields) {
          events.push({ name: eventName, atMs: Math.round(performance.now() - startedAt), fields });
        },
        end(status = 'ok', fields) {
          if (ended) {
            return;
          }
          ended = true;
          emit({
            id,
            traceId,
            parentSpanId,
            name,
            startedAt,
            durationMs: Math.round(performance.now() - startedAt),
            status,
            events,
            fields: { ...baseFields, ...(fields ?? {}) },
          });
        },
      };
    },
    subscribe(sink) {
      sinks.add(sink);
      return () => {
        sinks.delete(sink);
      };
    },
    recent() {
      return [...ring];
    },
  };
}

export const tracer = createTracer();
