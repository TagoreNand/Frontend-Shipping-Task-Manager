import { describe, expect, it } from 'vitest';
import { createAiTriageDataSource } from './aiTriageDataSource';
import { createMockDataSource } from './dataSource';

describe('createAiTriageDataSource', () => {
  it('annotates getTasks results with an AI suggestion', async () => {
    const ds = createAiTriageDataSource(createMockDataSource({ latencyMs: 0 }));
    const tasks = await ds.getTasks();
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.aiSuggestion !== undefined)).toBe(true);
  });

  it('delegates and re-annotates on moveTask', async () => {
    const ds = createAiTriageDataSource(createMockDataSource({ latencyMs: 0 }));
    const before = await ds.getTasks();
    const after = await ds.moveTask({ taskId: before[0].id, toStatus: 'complete', toIndex: 0 });
    const moved = after.find((t) => t.id === before[0].id);
    expect(moved?.status).toBe('complete');
    expect(moved?.aiSuggestion).toBeDefined();
  });
});
