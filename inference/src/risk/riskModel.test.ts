import { describe, expect, it } from 'vitest';
import { scoreRisk, scoreRiskBatch } from './riskModel';
import type { RiskInputTxn } from './riskModel';

const base: RiskInputTxn = { id: 't', amount: 1_000, accountAgeDays: 365, mode: 'ocean', restrictedLane: false };

describe('scoreRisk', () => {
  it('scores a benign transaction low', () => {
    expect(scoreRisk(base)).toBeLessThan(0.2);
  });
  it('scores a high-value, new-account, restricted-lane transaction high', () => {
    const risky = scoreRisk({ ...base, amount: 90_000, accountAgeDays: 2, restrictedLane: true });
    expect(risky).toBeGreaterThan(0.8);
  });
  it('returns a probability in [0,1]', () => {
    const s = scoreRisk({ ...base, amount: 60_000 });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
  it('batches scores by id', () => {
    expect(scoreRiskBatch([base, { ...base, id: 'u' }]).map((r) => r.id)).toEqual(['t', 'u']);
  });
});
