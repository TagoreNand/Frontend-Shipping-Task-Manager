import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './apiClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createApiClient', () => {
  it('sends auth + trace headers and returns parsed JSON', async () => {
    let captured: Record<string, string> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { headers: Record<string, string> }) => {
        captured = init.headers;
        return { ok: true, status: 200, json: async () => ({ value: 42 }) };
      }),
    );

    const client = createApiClient({ baseUrl: 'https://api.test', getAuthToken: () => 'tkn' });
    const data = await client.request<{ value: number }>('/x');

    expect(data.value).toBe(42);
    expect(captured.Authorization).toBe('Bearer tkn');
    expect(typeof captured['x-trace-id']).toBe('string');
  });

  it('sends a W3C traceparent header derived from the span', async () => {
    let captured: Record<string, string> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { headers: Record<string, string> }) => {
        captured = init.headers;
        return { ok: true, status: 200, json: async () => ({}) };
      }),
    );
    const client = createApiClient({ baseUrl: 'https://api.test' });
    await client.request('/x', { traceId: 'abcdef00abcdef00abcdef00abcdef00', parentSpanId: '1111111111111111' });
    expect(captured.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(captured.traceparent).toContain('abcdef00abcdef00abcdef00abcdef00');
    expect(captured.tracestate).toMatch(/^shiptivitas=s:[01]$/);
    expect(captured.baggage).toContain('deployment.environment');
  });

  it('invokes onAuthError and throws ApiError on 401 (no refresh)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })),
    );
    const onAuthError = vi.fn();
    const client = createApiClient({ baseUrl: 'https://api.test', onAuthError });

    await expect(client.request('/x')).rejects.toBeInstanceOf(ApiError);
    expect(onAuthError).toHaveBeenCalledTimes(1);
  });

  it('refreshes and retries once on 401, then succeeds', async () => {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1;
        return call === 1
          ? { ok: false, status: 401, json: async () => ({}) }
          : { ok: true, status: 200, json: async () => ({ ok: true }) };
      }),
    );
    const refreshAuth = vi.fn(async () => 'new-token');
    const client = createApiClient({ baseUrl: 'https://api.test', refreshAuth, getAuthToken: () => 'old' });

    const data = await client.request<{ ok: boolean }>('/x');
    expect(data.ok).toBe(true);
    expect(refreshAuth).toHaveBeenCalledTimes(1);
    expect(call).toBe(2);
  });

  it('clears auth when the refresh itself fails on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })),
    );
    const refreshAuth = vi.fn(async () => null);
    const onAuthError = vi.fn();
    const client = createApiClient({ baseUrl: 'https://api.test', refreshAuth, onAuthError });

    await expect(client.request('/x')).rejects.toBeInstanceOf(ApiError);
    expect(refreshAuth).toHaveBeenCalledTimes(1);
    expect(onAuthError).toHaveBeenCalledTimes(1);
  });
});
