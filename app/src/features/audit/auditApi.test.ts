import { afterEach, describe, expect, it, vi } from 'vitest';
import { listAudit } from './auditApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auditApi', () => {
  it('builds a filtered query string', async () => {
    let url = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (requestUrl: string) => {
        url = requestUrl;
        return { ok: true, status: 200, json: async () => [] };
      }),
    );
    await listAudit({ actor: 'admin', action: 'user.create' });
    expect(url).toContain('actor=admin');
    expect(url).toContain('action=user.create');
  });
});
