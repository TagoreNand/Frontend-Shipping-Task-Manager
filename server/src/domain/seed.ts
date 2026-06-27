import { generateKeys } from './fractionalIndex';
import type { Task } from './types';

interface SeedSpec {
  ref: string;
  title: string;
  mode: Task['mode'];
  origin: string;
  destination: string;
  priority: Task['priority'];
  status: Task['status'];
  etaInDays: number;
}

const SPECS: readonly SeedSpec[] = [
  { ref: 'OCN-1042', title: 'Container — Electronics', mode: 'ocean', origin: 'Shanghai', destination: 'Hamburg', priority: 'high', status: 'backlog', etaInDays: 21 },
  { ref: 'AIR-2207', title: 'Pallet — Medical Supplies', mode: 'air', origin: 'Frankfurt', destination: 'Tokyo', priority: 'critical', status: 'backlog', etaInDays: 2 },
  { ref: 'GND-3310', title: 'Truckload — Retail Goods', mode: 'ground', origin: 'Chicago', destination: 'Denver', priority: 'medium', status: 'backlog', etaInDays: 3 },
  { ref: 'OCN-1088', title: 'Container — Automotive Parts', mode: 'ocean', origin: 'Busan', destination: 'Long Beach', priority: 'high', status: 'backlog', etaInDays: 16 },
  { ref: 'AIR-2250', title: 'ULD — Semiconductors', mode: 'air', origin: 'Taipei', destination: 'Austin', priority: 'critical', status: 'in-progress', etaInDays: 1 },
  { ref: 'OCN-1101', title: 'Container — Furniture', mode: 'ocean', origin: 'Ho Chi Minh City', destination: 'Rotterdam', priority: 'medium', status: 'in-progress', etaInDays: 19 },
  { ref: 'GND-3344', title: 'LTL — Food Products', mode: 'ground', origin: 'Miami', destination: 'Atlanta', priority: 'high', status: 'in-progress', etaInDays: 2 },
  { ref: 'AIR-2299', title: 'Pallet — Aerospace Parts', mode: 'air', origin: 'Seattle', destination: 'Dubai', priority: 'critical', status: 'complete', etaInDays: -1 },
  { ref: 'OCN-1120', title: 'Container — Textiles', mode: 'ocean', origin: 'Mumbai', destination: 'Felixstowe', priority: 'medium', status: 'complete', etaInDays: -3 },
  { ref: 'RAIL-4530', title: 'Boxcar — Grain', mode: 'rail', origin: 'Omaha', destination: 'New Orleans', priority: 'medium', status: 'complete', etaInDays: -4 },
];

const DAY_MS = 86_400_000;

export function createSeedTasks(now: Date = new Date()): Task[] {
  const keys = generateKeys(SPECS.length);
  return SPECS.map((spec, index) => ({
    id: `task-${index + 1}`,
    ref: spec.ref,
    title: spec.title,
    description: `${spec.origin} → ${spec.destination}`,
    mode: spec.mode,
    origin: spec.origin,
    destination: spec.destination,
    priority: spec.priority,
    status: spec.status,
    etaAt: new Date(now.getTime() + spec.etaInDays * DAY_MS).toISOString(),
    updatedAt: now.toISOString(),
    order: keys[index],
  }));
}
