import { describe, expect, it } from 'vitest';
import { createMockDataSource } from './dataSource';

describe('createMockDataSource', () => {
  it('returns seeded tasks', async () => {
    const ds = createMockDataSource({ latencyMs: 0 });
    const tasks = await ds.getTasks();
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('applies a move and persists it', async () => {
    const ds = createMockDataSource({ latencyMs: 0 });
    const before = await ds.getTasks();
    const target = before[0];
    await ds.moveTask({ taskId: target.id, toStatus: 'complete', toIndex: 0 });
    const after = await ds.getTasks();
    expect(after.find((t) => t.id === target.id)?.status).toBe('complete');
  });

  it('rejects when the simulated failure rate is 1', async () => {
    const ds = createMockDataSource({ latencyMs: 0, failureRate: 1 });
    const tasks = await ds.getTasks();
    await expect(ds.moveTask({ taskId: tasks[0].id, toStatus: 'complete', toIndex: 0 })).rejects.toThrow();
  });
});
