/**
 * Transaction risk scorer — a logistic model over fraud-relevant features.
 * Returns a calibrated 0..1 ML risk score per transaction; the server combines
 * it with deterministic business rules to reach an approve/review/block decision.
 */
export interface RiskInputTxn {
  id: string;
  amount: number;
  accountAgeDays: number;
  mode: 'ocean' | 'air' | 'rail' | 'ground';
  restrictedLane: boolean;
}

export interface RiskScore {
  id: string;
  score: number;
}

const WEIGHTS = { bias: -2.5, amount: 2.0, newAccount: 1.5, restricted: 2.2, air: 0.3 };

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;

export function scoreRisk(txn: RiskInputTxn): number {
  const amountNorm = clamp(txn.amount / 100_000, 0, 1.5);
  const newAccount = txn.accountAgeDays < 7 ? 1 : 0;
  const restricted = txn.restrictedLane ? 1 : 0;
  const air = txn.mode === 'air' ? 1 : 0;
  const z =
    WEIGHTS.bias +
    WEIGHTS.amount * amountNorm +
    WEIGHTS.newAccount * newAccount +
    WEIGHTS.restricted * restricted +
    WEIGHTS.air * air;
  return round2(sigmoid(z));
}

export function scoreRiskBatch(txns: readonly RiskInputTxn[]): RiskScore[] {
  return txns.map((txn) => ({ id: txn.id, score: scoreRisk(txn) }));
}
