import type { Task, Transaction, TransactionRisk, TxnCustomerStatus, RiskDecision } from './types';

const HIGH_VALUE = 50_000;
const NEW_ACCOUNT_DAYS = 7;

/**
 * Enhanced due-diligence geographies (sanctions / AML screening corridors).
 * A shipment whose origin OR destination is on this list fires the geo_risk rule.
 * Distinct from the destination compliance watchlist that drives restricted_lane.
 */
const HIGH_RISK_GEO = new Set(['Tehran', 'Caracas', 'Pyongyang', 'Lagos', 'Karachi', 'Mumbai', 'Ho Chi Minh City']);

/** A customer making many shipments inside this window is flagged for velocity. */
const VELOCITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const VELOCITY_THRESHOLD = 3;

/** Context a rule may need beyond the bare transaction (owner behaviour, etc.). */
export interface RiskContext {
  /** Max number of the owner's transactions falling inside any VELOCITY_WINDOW_MS window. */
  ownerVelocity: number;
}

export const NO_CONTEXT: RiskContext = { ownerVelocity: 0 };

/** Deterministic business rules that fire on the transaction itself. */
export function evaluateRules(txn: Transaction): string[] {
  const reasons: string[] = [];
  if (txn.amount >= HIGH_VALUE) reasons.push('high_value');
  if (txn.accountAgeDays < NEW_ACCOUNT_DAYS) reasons.push('new_account');
  if (txn.restrictedLane) reasons.push('restricted_lane');
  return reasons;
}

/** Richer rules that need lane geography + owner behaviour (geo_risk, velocity). */
export function evaluateContextRules(task: Task, ctx: RiskContext): string[] {
  const reasons: string[] = [];
  if (HIGH_RISK_GEO.has(task.origin) || HIGH_RISK_GEO.has(task.destination)) {
    reasons.push('geo_risk');
  }
  if (ctx.ownerVelocity >= VELOCITY_THRESHOLD) {
    reasons.push('velocity');
  }
  return reasons;
}

/** All fired rules for a task (transaction + contextual). */
export function reasonsFor(task: Task, ctx: RiskContext = NO_CONTEXT): string[] {
  if (!task.transaction) {
    return [];
  }
  return [...evaluateRules(task.transaction), ...evaluateContextRules(task, ctx)];
}

/** Combine fired rules + an ML risk score into a decision. */
export function decide(reasons: readonly string[], mlScore: number): RiskDecision {
  const critical =
    reasons.includes('high_value') && (reasons.includes('restricted_lane') || reasons.includes('geo_risk'));
  if (mlScore >= 0.9 || (critical && mlScore >= 0.7)) {
    return 'block';
  }
  if (reasons.length > 0 || mlScore >= 0.6) {
    return 'review';
  }
  return 'approve';
}

export function evaluateRisk(task: Task, mlScore: number, ctx: RiskContext = NO_CONTEXT): TransactionRisk {
  const reasons = reasonsFor(task, ctx);
  const decision = decide(reasons, mlScore);
  return { score: mlScore, decision, reasons, reviewStatus: decision === 'approve' ? 'auto' : 'pending' };
}

/** Customer-visible status from a decision (review/block are held as 'processing'). */
export function customerStatusFor(decision: RiskDecision): TxnCustomerStatus {
  return decision === 'approve' ? 'cleared' : 'processing';
}

/**
 * Per-owner velocity: the largest number of that owner's transactions that fall
 * inside any rolling VELOCITY_WINDOW_MS window (a true rate, not a raw lifetime count).
 */
export function computeVelocity(tasks: readonly Task[]): Map<string, number> {
  const byOwner = new Map<string, number[]>();
  for (const task of tasks) {
    if (!task.owner || !task.transaction) continue;
    const ts = Date.parse(task.transaction.createdAt);
    if (Number.isNaN(ts)) continue;
    const list = byOwner.get(task.owner) ?? [];
    list.push(ts);
    byOwner.set(task.owner, list);
  }
  const out = new Map<string, number>();
  for (const [owner, times] of byOwner) {
    times.sort((a, b) => a - b);
    let best = 0;
    let lo = 0;
    for (let hi = 0; hi < times.length; hi++) {
      while (times[hi] - times[lo] > VELOCITY_WINDOW_MS) lo++;
      best = Math.max(best, hi - lo + 1);
    }
    out.set(owner, best);
  }
  return out;
}

/**
 * Assess every transaction that has no risk yet (idempotent across restarts):
 * scores via the injected scorer, applies transaction + contextual rules
 * (incl. per-owner velocity), derives the customer status.
 */
export async function assessTransactions(
  tasks: readonly Task[],
  scorer: (txns: readonly Transaction[]) => Promise<number[]>,
): Promise<Task[]> {
  const pending = tasks.filter((t) => t.transaction && !t.transaction.risk);
  if (pending.length === 0) {
    return tasks.slice();
  }
  const scores = await scorer(pending.map((t) => t.transaction as Transaction));
  const scoreById = new Map(pending.map((t, i) => [t.id, scores[i] ?? 0]));
  const velocity = computeVelocity(tasks);
  return tasks.map((task) => {
    if (!task.transaction || task.transaction.risk) {
      return task;
    }
    const ctx: RiskContext = { ownerVelocity: task.owner ? velocity.get(task.owner) ?? 0 : 0 };
    const risk = evaluateRisk(task, scoreById.get(task.id) ?? 0, ctx);
    return { ...task, transaction: { ...task.transaction, risk, customerStatus: customerStatusFor(risk.decision) } };
  });
}

/** Strip internal risk + sensitive fields for non-admin (customer) views. */
export function redactForRole(task: Task, role: string): Task {
  if (role === 'admin' || !task.transaction) {
    return task;
  }
  const { id, amount, currency, customerStatus, createdAt } = task.transaction;
  return { ...task, transaction: { id, amount, currency, customerStatus, createdAt, accountAgeDays: 0, restrictedLane: false } };
}

/** Apply an admin review decision to a held transaction. */
export function applyRiskDecision(
  tasks: readonly Task[],
  taskId: string,
  action: 'approve' | 'block',
  reviewer: string,
  at: string = new Date().toISOString(),
): Task[] {
  return tasks.map((task) => {
    if (task.id !== taskId || !task.transaction?.risk) {
      return task;
    }
    const reviewStatus = action === 'approve' ? 'approved' : 'blocked';
    const customerStatus: TxnCustomerStatus = action === 'approve' ? 'cleared' : 'failed';
    return {
      ...task,
      updatedAt: at,
      transaction: {
        ...task.transaction,
        customerStatus,
        risk: { ...task.transaction.risk, reviewStatus, reviewedBy: reviewer, reviewedAt: at },
      },
    };
  });
}
