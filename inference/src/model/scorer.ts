import { extractFeatures } from './features';
import type { Features, ModelArtifact, Priority, ScoredTask, TaskStatus, TriageInputTask, TriageSuggestion } from './types';

const PRIORITY_ORDER: readonly Priority[] = ['low', 'medium', 'high', 'critical'];
const DAY_MS = 86_400_000;
const round2 = (v: number): number => Math.round(v * 100) / 100;

function logit(weights: Record<string, number>, features: Features): number {
  let sum = weights.bias ?? 0;
  for (const [key, value] of Object.entries(features)) {
    sum += (weights[key] ?? 0) * value;
  }
  return sum;
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((value) => Math.exp(value - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((value) => value / total);
}

function escalatePriority(task: TriageInputTask, now: Date): Priority {
  const days = (Date.parse(task.etaAt) - now.getTime()) / DAY_MS;
  const eta: Priority = days <= 1 ? 'critical' : days <= 3 ? 'high' : days <= 7 ? 'medium' : 'low';
  return PRIORITY_ORDER.indexOf(eta) >= PRIORITY_ORDER.indexOf(task.priority) ? eta : task.priority;
}

/** Softmax linear model: logits per class, argmax → recommended status. */
export function scoreTask(model: ModelArtifact, task: TriageInputTask, now: Date = new Date()): TriageSuggestion {
  const features = extractFeatures(task, now);
  const probs = softmax(model.classes.map((cls) => logit(model.weights[cls], features)));
  let best = 0;
  for (let i = 1; i < probs.length; i += 1) {
    if (probs[i] > probs[best]) {
      best = i;
    }
  }
  const recommendedStatus: TaskStatus = model.classes[best];
  const confidence = round2(probs[best]);
  return {
    recommendedStatus,
    recommendedPriority: escalatePriority(task, now),
    confidence,
    rationale: `Model v${model.version}: ${Math.round(confidence * 100)}% confidence → ${recommendedStatus}.`,
  };
}

export function scoreBatch(model: ModelArtifact, tasks: readonly TriageInputTask[], now: Date = new Date()): ScoredTask[] {
  return tasks.map((task) => ({ taskId: task.id, ...scoreTask(model, task, now) }));
}
