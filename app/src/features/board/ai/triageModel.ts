import type { Priority, Task, TaskStatus, TriageSuggestion } from '../types';

const DAY_MS = 86_400_000;
const PRIORITY_ORDER: readonly Priority[] = ['low', 'medium', 'high', 'critical'];

function maxPriority(a: Priority, b: Priority): Priority {
  return PRIORITY_ORDER.indexOf(a) >= PRIORITY_ORDER.indexOf(b) ? a : b;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface TriageModel {
  score(task: Task, now?: Date): TriageSuggestion;
}

/**
 * Heuristic triage "model" — a deterministic stand-in for an ML/endpoint-backed
 * service. Pure and explainable, so it is trivially unit-tested and the seam for
 * a real model (or multi-agent router) is a single function swap.
 */
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
    const eta = Math.max(0, Math.round(days));
    rationale =
      days <= 3
        ? `ETA in ${eta}d — promote to active fulfilment to stay on schedule.`
        : 'Critical shipment — expedite into active fulfilment.';
    confidence = clamp(0.6 + (3 - Math.min(days, 3)) * 0.11, 0.6, 0.95);
  } else if (task.status === 'in-progress' && days < 0) {
    rationale = 'Past ETA and still in transit — escalate priority and expedite.';
    confidence = 0.8;
  } else {
    rationale = 'On track — maintain current lane.';
    confidence = 0.55;
  }

  return { recommendedStatus, recommendedPriority, confidence: round2(confidence), rationale };
}

export const defaultTriageModel: TriageModel = { score: scoreTask };

export function triageTasks(
  tasks: readonly Task[],
  now: Date = new Date(),
  model: TriageModel = defaultTriageModel,
): Task[] {
  return tasks.map((task) => ({ ...task, aiSuggestion: model.score(task, now) }));
}
