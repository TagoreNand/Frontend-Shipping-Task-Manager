import { describe, expect, it, vi } from 'vitest';
import { createOtlpExporter, parseHeaders, spansToResourceSpans } from './otlp';
import type { SpanData } from './otlp';

function span(over: Partial<SpanData> = {}): SpanData {
  return {
    traceId: '11111111-1111-1111-1111-111111111111',
    name: 'GET /tasks',
    kind: 2,
    startEpochMs: 1_700_000_000_000,
    durationMs: 12,
    status: 'ok',
    attributes: { 'http.status_code': 200 },
    ...over,
  };
}

interface Payload {
  resourceSpans: Array<{
    resource: { attributes: Array<{ key: string; value: { stringValue?: string } }> };
    scopeSpans: Array<{ spans: Array<{ traceId: string; spanId: string; status: { code: number } }> }>;
  }>;
}

describe('spansToResourceSpans', () => {
  it('builds an OTLP payload with resource attributes and hex ids', () => {
    const payload = spansToResourceSpans([span()], { 'service.name': 'svc' }) as Payload;
    const rs = payload.resourceSpans[0];
    expect(rs.resource.attributes[0]).toEqual({ key: 'service.name', value: { stringValue: 'svc' } });
    const sp = rs.scopeSpans[0].spans[0];
    expect(sp.traceId).toHaveLength(32);
    expect(sp.spanId).toHaveLength(16);
    expect(sp.status.code).toBe(1);
  });
});

describe('createOtlpExporter', () => {
  it('batches and POSTs to /v1/traces', () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetchImpl = vi.fn(async (url: string, init: { body: string }) => {
      calls.push({ url, body: init.body });
      return { ok: true };
    });
    const exporter = createOtlpExporter({
      endpoint: 'http://collector/',
      resourceAttributes: { 'service.name': 'svc' },
      batchSize: 2,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    exporter.export(span());
    expect(calls).toHaveLength(0);
    exporter.export(span());
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://collector/v1/traces');
  });

  it('parses headers and forwards them', () => {
    expect(parseHeaders('x-api-key=k,x-ds=traces')).toEqual({ 'x-api-key': 'k', 'x-ds': 'traces' });
    let headers: Record<string, string> = {};
    const fetchImpl = vi.fn(async (_url: string, init: { headers: Record<string, string> }) => {
      headers = init.headers;
      return { ok: true };
    });
    const exporter = createOtlpExporter({
      endpoint: 'http://collector',
      resourceAttributes: { 'service.name': 'svc' },
      batchSize: 1,
      headers: { 'x-api-key': 'k' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    exporter.export(span());
    expect(headers['x-api-key']).toBe('k');
  });
});
