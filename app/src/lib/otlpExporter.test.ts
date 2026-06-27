import { describe, expect, it } from 'vitest';
import { createOtlpExporter, parseHeaders, spansToOtlp } from './otlpExporter';
import type { CompletedSpan } from './telemetry';

function span(over: Partial<CompletedSpan> = {}): CompletedSpan {
  return {
    id: 'aaaaaaaaaaaaaaaa',
    traceId: '11111111-1111-1111-1111-111111111111',
    name: 'task.move',
    startedAt: 1_000,
    durationMs: 50,
    status: 'ok',
    events: [{ name: 'optimistic.applied', atMs: 10 }],
    fields: { taskId: 't1', retry: false, count: 3 },
    ...over,
  };
}

describe('spansToOtlp', () => {
  it('produces a valid OTLP payload', () => {
    const payload = spansToOtlp([span()], { 'service.name': 'svc', 'service.version': '1.2.3' }, 1_700_000_000_000);
    const resource = payload.resourceSpans[0];
    const names = resource.resource.attributes.map((a) => a.key);
    expect(names).toContain('service.name');
    expect(names).toContain('service.version');
    expect(resource.resource.attributes.find((a) => a.key === 'service.name')?.value.stringValue).toBe('svc');

    const otlp = resource.scopeSpans[0].spans[0];
    expect(otlp.traceId).toHaveLength(32);
    expect(otlp.spanId).toHaveLength(16);
    expect(otlp.status.code).toBe(1);
    expect(Number(otlp.endTimeUnixNano)).toBeGreaterThan(Number(otlp.startTimeUnixNano));
    expect(otlp.events[0].name).toBe('optimistic.applied');
    expect(otlp.attributes.find((a) => a.key === 'taskId')?.value.stringValue).toBe('t1');
  });

  it('maps error status to code 2', () => {
    const payload = spansToOtlp([span({ status: 'error' })], { 'service.name': 'svc' }, 0);
    expect(payload.resourceSpans[0].scopeSpans[0].spans[0].status.code).toBe(2);
  });
});

describe('parseHeaders', () => {
  it('parses a k=v,k=v header string', () => {
    expect(parseHeaders('x-honeycomb-team=abc,x-dataset=traces')).toEqual({ 'x-honeycomb-team': 'abc', 'x-dataset': 'traces' });
    expect(parseHeaders(undefined)).toEqual({});
  });
});

describe('createOtlpExporter', () => {
  it('drops spans when the sample rate is 0', () => {
    const calls: Array<{ url: string; body: string }> = [];
    const sink = createOtlpExporter({
      endpoint: 'http://collector',
      batchSize: 1,
      sampleRate: 0,
      send: (url, body) => calls.push({ url, body }),
    });
    sink(span());
    sink(span());
    expect(calls).toHaveLength(0);
  });

  it('batches and posts to /v1/traces', () => {
    const calls: Array<{ url: string; body: string }> = [];
    const sink = createOtlpExporter({
      endpoint: 'http://collector/',
      batchSize: 2,
      send: (url, body) => calls.push({ url, body }),
    });

    sink(span());
    expect(calls).toHaveLength(0);
    sink(span());
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://collector/v1/traces');
    const payload = JSON.parse(calls[0].body) as { resourceSpans: Array<{ scopeSpans: Array<{ spans: unknown[] }> }> };
    expect(payload.resourceSpans[0].scopeSpans[0].spans).toHaveLength(2);
  });

  it('forwards custom headers to the sender', () => {
    let seen: Record<string, string> = {};
    const sink = createOtlpExporter({
      endpoint: 'http://collector',
      batchSize: 1,
      headers: { 'x-honeycomb-team': 'abc' },
      send: (_url, _body, headers) => { seen = headers; },
    });
    sink(span());
    expect(seen['x-honeycomb-team']).toBe('abc');
  });
});
