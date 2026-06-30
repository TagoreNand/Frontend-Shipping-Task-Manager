import { afterEach, describe, expect, it, vi } from 'vitest';
import { decideRisk, listRiskQueue } from './riskApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('riskApi', () => {
  it('lists the risk queue', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [{ id: 't1', ref: 'OCN-1', title: 'x', transaction: { id: 'TXN', amount: 9, currency: 'USD', customerStatus: 'processing', risk: { score: 0.9, decision: 'block', reasons: ['high_value'], reviewStatus: 'pending' } } }],
      })),
    );
    const queue = await listRiskQueue();
    expect(queue[0].transaction.risk.decision).toBe('block');
  });

  it('sends an approve decision', async () => {
    let url = '';
    let body = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: string, init: { body: string }) => {
        url = u;
        body = init.body;
        return { ok: true, status: 200, json: async () => ({ id: 't1' }) };
      }),
    );
    await decideRisk('t1', 'approve');
    expect(url).toContain('/risk/t1');
    expect(body).toContain('approve');
  });
});
