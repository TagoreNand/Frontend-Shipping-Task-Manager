import { describe, expect, it } from 'vitest';
import {
  assessTransactions,
  computeVelocity,
  customerStatusFor,
  decide,
  evaluateContextRules,
  evaluateRisk,
  evaluateRules,
  redactForRole,
} from './risk';
import { createSeedTasks } from './seed';
import { createLocalRiskScorer } from '../risk/riskScorer';
import type { Task, Transaction } from './types';

const txn = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'TXN',
  amount: 1_000,
  currency: 'USD',
  accountAgeDays: 365,
  restrictedLane: false,
  customerStatus: 'pending',
  createdAt: 'now',
  ...over,
});

const task = (txnOver: Partial<Transaction> = {}, over: Partial<Task> = {}): Task => ({
  id: 'task-x',
  ref: 'REF',
  title: 'Shipment',
  description: 'd',
  mode: 'ocean',
  origin: 'Shanghai',
  destination: 'Hamburg',
  priority: 'low',
  status: 'backlog',
  etaAt: 'now',
  updatedAt: 'now',
  order: 'a0',
  transaction: txn(txnOver),
  ...over,
});

describe('risk rules + decision', () => {
  it('fires the right transaction rules', () => {
    expect(evaluateRules(txn({ amount: 60_000, accountAgeDays: 2, restrictedLane: true }))).toEqual([
      'high_value',
      'new_account',
      'restricted_lane',
    ]);
    expect(evaluateRules(txn())).toEqual([]);
  });

  it('fires geo_risk on an enhanced-due-diligence lane and velocity past the threshold', () => {
    expect(evaluateContextRules(task({}, { origin: 'Mumbai' }), { ownerVelocity: 1 })).toEqual(['geo_risk']);
    expect(evaluateContextRules(task({}, { destination: 'Tehran' }), { ownerVelocity: 1 })).toEqual(['geo_risk']);
    expect(evaluateContextRules(task(), { ownerVelocity: 3 })).toEqual(['velocity']);
    expect(evaluateContextRules(task(), { ownerVelocity: 1 })).toEqual([]);
  });

  it('decides approve / review / block (geo counts as a critical pairing)', () => {
    expect(decide([], 0.1)).toBe('approve');
    expect(decide(['new_account'], 0.2)).toBe('review');
    expect(decide(['velocity'], 0.2)).toBe('review');
    expect(decide([], 0.95)).toBe('block');
    expect(decide(['high_value', 'restricted_lane'], 0.75)).toBe('block');
    expect(decide(['high_value', 'geo_risk'], 0.75)).toBe('block');
  });

  it('maps decisions to review + customer status', () => {
    expect(evaluateRisk(task(), 0.1).reviewStatus).toBe('auto');
    expect(evaluateRisk(task({ amount: 60_000 }), 0.2).reviewStatus).toBe('pending');
    expect(customerStatusFor('approve')).toBe('cleared');
    expect(customerStatusFor('review')).toBe('processing');
    expect(customerStatusFor('block')).toBe('processing');
  });
});

describe('computeVelocity', () => {
  it('counts the most transactions by one owner inside a rolling 24h window', () => {
    const base = Date.parse('2025-06-01T00:00:00.000Z');
    const at = (ms: number) => new Date(base + ms).toISOString();
    const tasks: Task[] = [
      task({ createdAt: at(0) }, { id: 'a1', owner: 'acme' }),
      task({ createdAt: at(60_000) }, { id: 'a2', owner: 'acme' }),
      task({ createdAt: at(120_000) }, { id: 'a3', owner: 'acme' }),
      task({ createdAt: at(0) }, { id: 'g1', owner: 'globex' }),
      task({ createdAt: at(0) }, { id: 'n1', owner: undefined }),
    ];
    const v = computeVelocity(tasks);
    expect(v.get('acme')).toBe(3);
    expect(v.get('globex')).toBe(1);
    expect(v.has('')).toBe(false);
  });
});

describe('assessTransactions', () => {
  it('assesses risk, derives customer status, and is idempotent', async () => {
    const assessed = await assessTransactions(createSeedTasks(new Date('2025-06-01T00:00:00.000Z')), createLocalRiskScorer());
    expect(assessed.every((t) => t.transaction?.risk)).toBe(true);
    const blocked = assessed.find((t) => t.ref === 'AIR-2299'); // Dubai · high value · new account
    expect(blocked?.transaction?.risk?.decision).toBe('block');
    expect(blocked?.transaction?.customerStatus).toBe('processing');
    expect(await assessTransactions(assessed, createLocalRiskScorer())).toEqual(assessed);
  });

  it('flags velocity for a high-frequency owner and geo_risk on watch geographies', async () => {
    const assessed = await assessTransactions(createSeedTasks(new Date('2025-06-01T00:00:00.000Z')), createLocalRiskScorer());
    const acme = assessed.filter((t) => t.owner === 'acme'); // owns 3 seed shipments
    expect(acme.length).toBeGreaterThanOrEqual(3);
    expect(acme.every((t) => t.transaction?.risk?.reasons.includes('velocity'))).toBe(true);
    const geo = assessed.find((t) => t.ref === 'OCN-1120'); // Mumbai origin
    expect(geo?.transaction?.risk?.reasons).toContain('geo_risk');
  });
});

describe('redactForRole', () => {
  it('hides risk from non-admins but keeps the amount', async () => {
    const [first] = await assessTransactions(createSeedTasks(), createLocalRiskScorer());
    expect(redactForRole(first, 'admin').transaction?.risk).toBeDefined();
    const redacted = redactForRole(first, 'customer');
    expect(redacted.transaction?.risk).toBeUndefined();
    expect(redacted.transaction?.amount).toBe(first.transaction?.amount);
  });
});
