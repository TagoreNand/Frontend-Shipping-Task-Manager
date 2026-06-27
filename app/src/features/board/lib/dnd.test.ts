import { describe, expect, it } from 'vitest';
import { isTaskStatus, resolveDrop } from './dnd';
import type { TasksByStatus } from '../types';

const groups: TasksByStatus = {
  backlog: [
    { id: 'a', ref: 'A', title: 'A', description: '', mode: 'ocean', origin: '', destination: '', priority: 'low', status: 'backlog', etaAt: '', updatedAt: '', order: 'a1' },
  ],
  'in-progress': [
    { id: 'b', ref: 'B', title: 'B', description: '', mode: 'air', origin: '', destination: '', priority: 'low', status: 'in-progress', etaAt: '', updatedAt: '', order: 'a1' },
  ],
  complete: [],
};

describe('isTaskStatus', () => {
  it('recognises lane ids', () => {
    expect(isTaskStatus('backlog')).toBe(true);
    expect(isTaskStatus('task-1')).toBe(false);
  });
});

describe('resolveDrop', () => {
  it('appends when dropping onto a lane container', () => {
    expect(resolveDrop(groups, 'a', 'complete')).toEqual({ toStatus: 'complete', toIndex: 0 });
  });

  it('inserts at the target card position', () => {
    expect(resolveDrop(groups, 'a', 'b')).toEqual({ toStatus: 'in-progress', toIndex: 0 });
  });

  it('returns null for an unknown active id', () => {
    expect(resolveDrop(groups, 'ghost', 'b')).toBeNull();
  });
});
