import { describe, expect, it } from 'vitest';
import { createTracer, shouldSample } from './telemetry';
import type { CompletedSpan } from './telemetry';

describe('shouldSample', () => {
  it('honours the rate bounds and is deterministic', () => {
    expect(shouldSample('any', 1)).toBe(true);
    expect(shouldSample('any', 0)).toBe(false);
    expect(shouldSample('trace-x', 0.5)).toBe(shouldSample('trace-x', 0.5));
  });
});

describe('createTracer', () => {
  it('emits a completed span with duration, status, events and fields', () => {
    const tracer = createTracer();
    const seen: CompletedSpan[] = [];
    tracer.subscribe((span) => seen.push(span));

    const span = tracer.startSpan('op', { traceId: 't1', fields: { a: 1 } });
    span.event('step');
    span.end('ok', { b: 2 });

    expect(seen).toHaveLength(1);
    expect(seen[0].traceId).toBe('t1');
    expect(seen[0].status).toBe('ok');
    expect(seen[0].events.map((event) => event.name)).toEqual(['step']);
    expect(seen[0].fields).toMatchObject({ a: 1, b: 2 });
    expect(typeof seen[0].durationMs).toBe('number');
  });

  it('ignores a second end() and keeps a bounded buffer', () => {
    const tracer = createTracer(2);
    const seen: CompletedSpan[] = [];
    tracer.subscribe((span) => seen.push(span));

    const span = tracer.startSpan('x');
    span.end();
    span.end();
    expect(seen).toHaveLength(1);

    tracer.startSpan('a').end();
    tracer.startSpan('b').end();
    tracer.startSpan('c').end();
    expect(tracer.recent()).toHaveLength(2);
  });

  it('records an explicit span id, trace id and parent span id', () => {
    const tracer = createTracer();
    const seen: CompletedSpan[] = [];
    tracer.subscribe((span) => seen.push(span));
    tracer.startSpan('child', { traceId: 't', spanId: 's', parentSpanId: 'p' }).end();
    expect(seen[0].traceId).toBe('t');
    expect(seen[0].id).toBe('s');
    expect(seen[0].parentSpanId).toBe('p');
  });

  it('stops delivering after unsubscribe', () => {
    const tracer = createTracer();
    const seen: CompletedSpan[] = [];
    const off = tracer.subscribe((span) => seen.push(span));
    off();
    tracer.startSpan('x').end();
    expect(seen).toHaveLength(0);
  });
});
