import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scoreTask } from './scorer';
import { loadModel } from './load';
import type { TriageInputTask } from './types';

const model = loadModel(path.join(process.cwd(), 'model.json'));
const NOW = new Date('2025-06-01T00:00:00.000Z');
const DAY = 86_400_000;

function task(over: Partial<TriageInputTask>): TriageInputTask {
  return {
    id: 'x',
    status: 'backlog',
    priority: 'low',
    mode: 'ocean',
    etaAt: new Date(NOW.getTime() + 30 * DAY).toISOString(),
    ...over,
  };
}

describe('scoreTask', () => {
  it('keeps completed tasks complete', () => {
    const s = scoreTask(model, task({ status: 'complete', etaAt: new Date(NOW.getTime() - DAY).toISOString() }), NOW);
    expect(s.recommendedStatus).toBe('complete');
  });

  it('promotes a critical air backlog task near ETA to in-progress', () => {
    const s = scoreTask(model, task({ status: 'backlog', priority: 'critical', mode: 'air', etaAt: new Date(NOW.getTime() + DAY).toISOString() }), NOW);
    expect(s.recommendedStatus).toBe('in-progress');
  });

  it('keeps a distant-ETA backlog task in backlog', () => {
    expect(scoreTask(model, task({ status: 'backlog' }), NOW).recommendedStatus).toBe('backlog');
  });

  it('returns a calibrated confidence in (0,1]', () => {
    const s = scoreTask(model, task({}), NOW);
    expect(s.confidence).toBeGreaterThan(0);
    expect(s.confidence).toBeLessThanOrEqual(1);
  });
});
