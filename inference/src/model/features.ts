import type { Features, TriageInputTask } from './types';

const DAY_MS = 86_400_000;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Map a task into the model's feature space. */
export function extractFeatures(task: TriageInputTask, now: Date = new Date()): Features {
  const days = (Date.parse(task.etaAt) - now.getTime()) / DAY_MS;
  return {
    nearness: clamp((7 - days) / 7, -1, 1),
    critical: task.priority === 'critical' ? 1 : 0,
    air: task.mode === 'air' ? 1 : 0,
    fromBacklog: task.status === 'backlog' ? 1 : 0,
    fromInProgress: task.status === 'in-progress' ? 1 : 0,
    fromComplete: task.status === 'complete' ? 1 : 0,
  };
}
