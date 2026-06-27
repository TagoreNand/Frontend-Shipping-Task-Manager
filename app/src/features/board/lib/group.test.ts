import { describe, expect, it } from 'vitest';
import { computeStats, filterTasks, groupByStatus, moveTask } from './group';
import type { Task } from '../types';

let seq = 0;
function makeTask(over: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: over.id ?? `t${seq}`,
    ref: over.ref ?? `REF-${seq}`,
    title: over.title ?? 'Title',
    description: over.description ?? 'Desc',
    mode: over.mode ?? 'ocean',
    origin: over.origin ?? 'A',
    destination: over.destination ?? 'B',
    priority: over.priority ?? 'low',
    status: over.status ?? 'backlog',
    etaAt: over.etaAt ?? '2025-01-01T00:00:00.000Z',
    updatedAt: over.updatedAt ?? '2025-01-01T00:00:00.000Z',
    order: over.order ?? 'a0',
  };
}

describe('groupByStatus', () => {
  it('buckets tasks into status lanes sorted by order', () => {
    const tasks = [
      makeTask({ id: 'a', status: 'backlog', order: 'a1' }),
      makeTask({ id: 'b', status: 'backlog', order: 'a0' }),
      makeTask({ id: 'c', status: 'complete', order: 'a0' }),
    ];
    const groups = groupByStatus(tasks);
    expect(groups.backlog.map((t) => t.id)).toEqual(['b', 'a']);
    expect(groups.complete.map((t) => t.id)).toEqual(['c']);
    expect(groups['in-progress']).toEqual([]);
  });
});

describe('moveTask', () => {
  const base = [
    makeTask({ id: 'a', status: 'backlog', order: 'a0' }),
    makeTask({ id: 'b', status: 'backlog', order: 'a1' }),
    makeTask({ id: 'c', status: 'in-progress', order: 'a0' }),
  ];

  it('moves a task across lanes and reindexes order', () => {
    const next = moveTask(base, 'a', 'complete', 0, '2025-02-02T00:00:00.000Z');
    const moved = next.find((t) => t.id === 'a');
    expect(moved?.status).toBe('complete');
    expect(typeof moved?.order).toBe('string');
    expect(moved?.updatedAt).toBe('2025-02-02T00:00:00.000Z');
    // only the moved task changes — neighbours keep their keys (no re-index)
    expect(next.find((t) => t.id === 'b')?.order).toBe('a1');
  });

  it('reorders within the same lane', () => {
    const next = moveTask(base, 'b', 'backlog', 0);
    const lane = groupByStatus(next).backlog.map((t) => t.id);
    expect(lane).toEqual(['b', 'a']);
  });

  it('returns an unchanged copy for an unknown id', () => {
    const next = moveTask(base, 'missing', 'complete', 0);
    expect(next).not.toBe(base);
    expect(next).toHaveLength(base.length);
  });
});

describe('computeStats', () => {
  it('counts by status and derives completion rate', () => {
    const tasks = [
      makeTask({ status: 'backlog', priority: 'critical' }),
      makeTask({ status: 'complete' }),
      makeTask({ status: 'complete' }),
      makeTask({ status: 'in-progress' }),
    ];
    const stats = computeStats(tasks);
    expect(stats.total).toBe(4);
    expect(stats.byStatus.complete).toBe(2);
    expect(stats.critical).toBe(1);
    expect(stats.completionRate).toBeCloseTo(0.5);
  });

  it('is safe for an empty board', () => {
    expect(computeStats([]).completionRate).toBe(0);
  });
});

describe('filterTasks', () => {
  const tasks = [
    makeTask({ ref: 'OCN-1', mode: 'ocean', priority: 'high', origin: 'Shanghai' }),
    makeTask({ ref: 'AIR-2', mode: 'air', priority: 'low', origin: 'Tokyo' }),
  ];

  it('filters by mode', () => {
    expect(filterTasks(tasks, { search: '', mode: 'air', priority: 'all' })).toHaveLength(1);
  });

  it('filters by priority', () => {
    expect(filterTasks(tasks, { search: '', mode: 'all', priority: 'high' })).toHaveLength(1);
  });

  it('searches ref and route case-insensitively', () => {
    expect(filterTasks(tasks, { search: 'shanghai', mode: 'all', priority: 'all' })).toHaveLength(1);
    expect(filterTasks(tasks, { search: 'ocn', mode: 'all', priority: 'all' })).toHaveLength(1);
  });
});
