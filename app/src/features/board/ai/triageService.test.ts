import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpTriageService, createLocalTriageService } from './triageService';
import { createSeedTasks } from '../api/seed';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createLocalTriageService', () => {
  it('scores every task', async () => {
    const tasks = createSeedTasks(new Date(), 3);
    const suggestions = await createLocalTriageService().scoreBatch(tasks);
    expect(suggestions).toHaveLength(3);
    expect(suggestions.every((s) => typeof s.rationale === 'string')).toBe(true);
  });
});

describe('createHttpTriageService', () => {
  it('uses remote suggestions on success', async () => {
    const tasks = createSeedTasks(new Date(), 1);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          suggestions: [
            {
              taskId: 'task-1',
              recommendedStatus: 'complete',
              recommendedPriority: 'high',
              confidence: 0.91,
              rationale: 'remote-model',
            },
          ],
        }),
      })),
    );
    const suggestions = await createHttpTriageService('https://api.test').scoreBatch(tasks);
    expect(suggestions[0].rationale).toBe('remote-model');
    expect(suggestions[0].recommendedStatus).toBe('complete');
  });

  it('falls back to the local heuristic on failure', async () => {
    const tasks = createSeedTasks(new Date(), 2);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const suggestions = await createHttpTriageService('https://api.test').scoreBatch(tasks);
    expect(suggestions).toHaveLength(2);
    expect(suggestions.every((s) => s.rationale !== 'remote-model')).toBe(true);
  });
});
