import type { Transaction } from '../domain/types';

export type RiskScorer = (txns: readonly Transaction[]) => Promise<number[]>;

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Local logistic risk score — mirrors the inference model; no network needed. */
export function localRiskScore(txn: Transaction): number {
  const amountNorm = clamp(txn.amount / 100_000, 0, 1.5);
  const newAccount = txn.accountAgeDays < 7 ? 1 : 0;
  const restricted = txn.restrictedLane ? 1 : 0;
  const z = -2.5 + 2.0 * amountNorm + 1.5 * newAccount + 2.2 * restricted;
  return round2(sigmoid(z));
}

export function createLocalRiskScorer(): RiskScorer {
  return (txns) => Promise.resolve(txns.map(localRiskScore));
}

/** Calls the inference service POST /risk; falls back to the local model on error. */
export function createHttpRiskScorer(url: string, fallback: RiskScorer = createLocalRiskScorer()): RiskScorer {
  return async (txns) => {
    if (txns.length === 0) {
      return [];
    }
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: txns.map((t) => ({
            id: t.id,
            amount: t.amount,
            accountAgeDays: t.accountAgeDays,
            mode: 'ocean',
            restrictedLane: t.restrictedLane,
          })),
        }),
      });
      if (!response.ok) {
        return fallback(txns);
      }
      const data = (await response.json()) as { scores: Array<{ id: string; score: number }> };
      const byId = new Map(data.scores.map((s) => [s.id, s.score]));
      return txns.map((t) => byId.get(t.id) ?? localRiskScore(t));
    } catch {
      return fallback(txns);
    }
  };
}
