import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpRiskScorer, createLocalRiskScorer } from './riskScorer';
import type { Transaction } from '../domain/types';

const txn = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't',
  amount: 1_000,
  currency: 'USD',
  accountAgeDays: 365,
  restrictedLane: false,
  customerStatus: 'pending',
  createdAt: 'now',
  ...over,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('riskScorer', () => {
  it('local scorer ranks risky above benign', async () => {
    const [low, high] = await createLocalRiskScorer()([txn(), txn({ amount: 90_000, accountAgeDays: 2, restrictedLane: true })]);
    expect(high).toBeGreaterThan(low);
  });

  it('http scorer uses inference scores', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ scores: [{ id: 't', score: 0.42 }] }) })));
    expect(await createHttpRiskScorer('http://inference')([txn()])).toEqual([0.42]);
  });

  it('http scorer falls back to the local model on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('inference down');
    }));
    const [score] = await createHttpRiskScorer('http://inference')([txn({ amount: 90_000, accountAgeDays: 2, restrictedLane: true })]);
    expect(score).toBeGreaterThan(0.8);
  });
});
