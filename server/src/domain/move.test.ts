import { describe, expect, it } from 'vitest';
import { applyMove } from './move';
import { createSeedTasks } from './seed';

describe('applyMove', () => {
  it('moves a task across lanes, changing only that row', () => {
    const tasks = createSeedTasks(new Date('2025-06-01T00:00:00.000Z'));
    const target = tasks.find((task) => task.status === 'backlog')!;
    const untouched = tasks.filter((t) => t.id !== target.id).map((t) => ({ id: t.id, order: t.order }));

    const next = applyMove(tasks, target.id, 'complete', 0);
    expect(next.find((t) => t.id === target.id)?.status).toBe('complete');
    for (const row of untouched) {
      expect(next.find((t) => t.id === row.id)?.order).toBe(row.order);
    }
  });

  it('returns a copy for an unknown id', () => {
    const tasks = createSeedTasks();
    expect(applyMove(tasks, 'nope', 'complete', 0)).toHaveLength(tasks.length);
  });
});
