/**
 * Trains the triage model: multinomial logistic regression (softmax) over the
 * service's own feature extraction, on a seeded synthetic dataset labelled by
 * domain rules + label noise. Writes learned weights to ../model.json.
 *
 *   npm run train
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { extractFeatures } from '../src/model/features';
import type { Features, ModelArtifact, Priority, ShipMode, TaskStatus } from '../src/model/types';

const CLASSES: TaskStatus[] = ['backlog', 'in-progress', 'complete'];
const FEATURES: (keyof Features)[] = ['nearness', 'critical', 'air', 'fromBacklog', 'fromInProgress', 'fromComplete'];
const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];
const MODES: ShipMode[] = ['ocean', 'air', 'rail', 'ground'];
const NOW = new Date('2025-06-01T00:00:00.000Z');
const DAY = 86_400_000;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

function trueLabel(status: TaskStatus, priority: Priority, days: number): TaskStatus {
  if (status === 'complete') return 'complete';
  if (status === 'backlog' && (days <= 3 || priority === 'critical')) return 'in-progress';
  if (status === 'in-progress' && days < 0) return 'in-progress';
  return status;
}

interface Sample {
  x: number[];
  y: number;
}
function makeSample(): Sample {
  const status = pick(CLASSES);
  const priority = pick(PRIORITIES);
  const mode = pick(MODES);
  const days = Math.round((rng() * 40 - 5) * 10) / 10;
  const etaAt = new Date(NOW.getTime() + days * DAY).toISOString();
  const features = extractFeatures({ id: 's', status, priority, mode, etaAt }, NOW);
  let label = trueLabel(status, priority, days);
  if (rng() < 0.08) label = pick(CLASSES);
  return { x: FEATURES.map((f) => features[f]), y: CLASSES.indexOf(label) };
}

function softmax(logits: number[]): number[] {
  const m = Math.max(...logits);
  const e = logits.map((v) => Math.exp(v - m));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / sum);
}
function predictProbs(x: number[], W: number[][], b: number[]): number[] {
  return softmax(W.map((w, c) => b[c] + w.reduce((acc, wj, j) => acc + wj * x[j], 0)));
}

function train(samples: Sample[], iters: number, lr: number, l2: number): { W: number[][]; b: number[] } {
  const C = CLASSES.length;
  const F = FEATURES.length;
  const W = Array.from({ length: C }, () => new Array<number>(F).fill(0));
  const b = new Array<number>(C).fill(0);
  for (let it = 0; it < iters; it += 1) {
    const gW = Array.from({ length: C }, () => new Array<number>(F).fill(0));
    const gb = new Array<number>(C).fill(0);
    for (const { x, y } of samples) {
      const p = predictProbs(x, W, b);
      for (let c = 0; c < C; c += 1) {
        const err = p[c] - (c === y ? 1 : 0);
        gb[c] += err;
        for (let j = 0; j < F; j += 1) gW[c][j] += err * x[j];
      }
    }
    const n = samples.length;
    for (let c = 0; c < C; c += 1) {
      b[c] -= lr * (gb[c] / n);
      for (let j = 0; j < F; j += 1) W[c][j] -= lr * (gW[c][j] / n + l2 * W[c][j]);
    }
  }
  return { W, b };
}

function accuracy(samples: Sample[], W: number[][], b: number[]): number {
  let correct = 0;
  for (const { x, y } of samples) {
    const p = predictProbs(x, W, b);
    let best = 0;
    for (let c = 1; c < p.length; c += 1) if (p[c] > p[best]) best = c;
    if (best === y) correct += 1;
  }
  return correct / samples.length;
}

const round = (v: number): number => Math.round(v * 10000) / 10000;

const all = Array.from({ length: 5000 }, makeSample);
const split = Math.floor(all.length * 0.8);
const { W, b } = train(all.slice(0, split), 4000, 0.5, 1e-4);
const acc = accuracy(all.slice(split), W, b);

const weights = {} as Record<TaskStatus, Record<string, number>>;
CLASSES.forEach((cls, c) => {
  const row: Record<string, number> = { bias: round(b[c]) };
  FEATURES.forEach((f, j) => {
    row[f] = round(W[c][j]);
  });
  weights[cls] = row;
});

const artifact: ModelArtifact = {
  version: '2.0.0',
  trainedAt: new Date().toISOString(),
  classes: CLASSES,
  features: FEATURES as string[],
  weights,
  metrics: { samples: all.length, accuracy: round(acc) },
};
writeFileSync(path.join(process.cwd(), 'model.json'), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`Trained on ${all.length} samples; validation accuracy = ${acc.toFixed(3)}`);
