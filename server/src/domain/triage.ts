import type { Priority, Task, TaskStatus } from './types';

export interface TriageSuggestion {
  recommendedStatus: TaskStatus;
  recommendedPriority: Priority;
  confidence: number;
  rationale: string;
}

const DAY_MS = 86_400_000;
const PRIORITY_ORDER: readonly Priority[] = ['low', 'medium', 'high', 'critical'];

const maxPriority = (a: Priority, b: Priority): Priority =>
  PRIORITY_ORDER.indexOf(a) >= PRIORITY_ORDER.indexOf(b) ? a : b;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;

export function scoreTask(task: Task, now: Date = new Date()): TriageSuggestion {
  const days = (Date.parse(task.etaAt) - now.getTime()) / DAY_MS;
  const etaPriority: Priority = days <= 1 ? 'critical' : days <= 3 ? 'high' : days <= 7 ? 'medium' : 'low';
  const recommendedPriority = maxPriority(task.priority, etaPriority);

  let recommendedStatus: TaskStatus = task.status;
  let rationale: string;
  let confidence: number;

  if (task.status === 'complete') {
    rationale = 'Delivered — no action required.';
    confidence = 0.92;
  } else if (task.status === 'backlog' && (days <= 3 || recommendedPriority === 'critical')) {
    recommendedStatus = 'in-progress';
    rationale = days <= 3 ? 'ETA imminent — promote to active fulfilment.' : 'Critical shipment — expedite.';
    confidence = clamp(0.6 + (3 - Math.min(days, 3)) * 0.11, 0.6, 0.95);
  } else if (task.status === 'in-progress' && days < 0) {
    rationale = 'Past ETA and still in transit — escalate.';
    confidence = 0.8;
  } else {
    rationale = 'On track — maintain current lane.';
    confidence = 0.55;
  }
  return { recommendedStatus, recommendedPriority, confidence: round2(confidence), rationale };
}

export interface ScoredTask extends TriageSuggestion {
  taskId: string;
}

export function scoreBatch(tasks: readonly Task[], now: Date = new Date()): ScoredTask[] {
  return tasks.map((task) => ({ taskId: task.id, ...scoreTask(task, now) }));
}
