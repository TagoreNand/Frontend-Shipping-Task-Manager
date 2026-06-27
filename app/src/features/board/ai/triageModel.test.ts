import { describe, expect, it } from 'vitest';
import { scoreTask, triageTasks } from './triageModel';
import type { Task } from '../types';

const NOW = new Date('2025-06-01T00:00:00.000Z');
const DAY = 86_400_000;

function task(over: Partial<Task>): Task {
  return {
    id: 'x',
    ref: 'REF',
    title: 'T',
    description: 'D',
    mode: 'ocean',
    origin: 'A',
    destination: 'B',
    priority: 'low',
    status: 'backlog',
    etaAt: new Date(NOW.getTime() + 30 * DAY).toISOString(),
    updatedAt: NOW.toISOString(),
    order: 'a1',
    ...over,
  };
}

describe('scoreTask', () => {
  it('promotes an imminent backlog task to in-progress', () => {
    const s = scoreTask(task({ status: 'backlog', etaAt: new Date(NOW.getTime() + DAY).toISOString() }), NOW);
    expect(s.recommendedStatus).toBe('in-progress');
    expect(s.recommendedPriority).toBe('critical');
    expect(s.confidence).toBeGreaterThanOrEqual(0.6);
    expect(s.confidence).toBeLessThanOrEqual(0.95);
  });

  it('expedites a critical backlog task even with a distant ETA', () => {
    const s = scoreTask(task({ status: 'backlog', priority: 'critical' }), NOW);
    expect(s.recommendedStatus).toBe('in-progress');
  });

  it('leaves on-track backlog tasks alone', () => {
    const s = scoreTask(task({ status: 'backlog', priority: 'low' }), NOW);
    expect(s.recommendedStatus).toBe('backlog');
  });

  it('keeps completed tasks complete', () => {
    const s = scoreTask(task({ status: 'complete' }), NOW);
    expect(s.recommendedStatus).toBe('complete');
  });

  it('never downgrades existing priority', () => {
    const s = scoreTask(task({ status: 'in-progress', priority: 'high' }), NOW);
    expect(s.recommendedPriority).toBe('high');
    expect(s.confidence).toBeGreaterThanOrEqual(0);
    expect(s.confidence).toBeLessThanOrEqual(1);
  });
});

describe('triageTasks', () => {
  it('attaches a suggestion to every task', () => {
    const result = triageTasks([task({ id: 'a' }), task({ id: 'b' })], NOW);
    expect(result.every((t) => t.aiSuggestion !== undefined)).toBe(true);
  });
});
