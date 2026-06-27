import { generateKeys } from '../lib/fractionalIndex';
import type { Task } from '../types';

interface SeedSpec {
  ref: string;
  title: string;
  description: string;
  mode: Task['mode'];
  origin: string;
  destination: string;
  priority: Task['priority'];
  status: Task['status'];
  etaInDays: number;
}

const SPECS: readonly SeedSpec[] = [
  { ref: 'OCN-1042', title: 'Container — Electronics', description: 'High-value consumer electronics, reefer not required.', mode: 'ocean', origin: 'Shanghai', destination: 'Hamburg', priority: 'high', status: 'backlog', etaInDays: 21 },
  { ref: 'AIR-2207', title: 'Pallet — Medical Supplies', description: 'Temperature-sensitive, expedited customs.', mode: 'air', origin: 'Frankfurt', destination: 'Tokyo', priority: 'critical', status: 'backlog', etaInDays: 2 },
  { ref: 'GND-3310', title: 'Truckload — Retail Goods', description: 'Domestic FTL, dock-to-dock.', mode: 'ground', origin: 'Chicago', destination: 'Denver', priority: 'medium', status: 'backlog', etaInDays: 3 },
  { ref: 'RAIL-4471', title: 'Boxcar — Raw Steel', description: 'Bulk industrial freight.', mode: 'rail', origin: 'Pittsburgh', destination: 'Houston', priority: 'low', status: 'backlog', etaInDays: 6 },
  { ref: 'OCN-1088', title: 'Container — Automotive Parts', description: 'JIT components for assembly line.', mode: 'ocean', origin: 'Busan', destination: 'Long Beach', priority: 'high', status: 'backlog', etaInDays: 16 },
  { ref: 'AIR-2250', title: 'ULD — Semiconductors', description: 'Anti-static packaging, insured.', mode: 'air', origin: 'Taipei', destination: 'Austin', priority: 'critical', status: 'in-progress', etaInDays: 1 },
  { ref: 'OCN-1101', title: 'Container — Furniture', description: 'Flat-pack, stackable.', mode: 'ocean', origin: 'Ho Chi Minh City', destination: 'Rotterdam', priority: 'medium', status: 'in-progress', etaInDays: 19 },
  { ref: 'GND-3344', title: 'LTL — Food Products', description: 'Refrigerated, FDA-tracked.', mode: 'ground', origin: 'Miami', destination: 'Atlanta', priority: 'high', status: 'in-progress', etaInDays: 2 },
  { ref: 'RAIL-4502', title: 'Intermodal — Lumber', description: 'Double-stack intermodal.', mode: 'rail', origin: 'Vancouver', destination: 'Memphis', priority: 'low', status: 'in-progress', etaInDays: 5 },
  { ref: 'AIR-2299', title: 'Pallet — Aerospace Parts', description: 'AOG, time-critical.', mode: 'air', origin: 'Seattle', destination: 'Dubai', priority: 'critical', status: 'complete', etaInDays: -1 },
  { ref: 'OCN-1120', title: 'Container — Textiles', description: 'Apparel for retail season.', mode: 'ocean', origin: 'Mumbai', destination: 'Felixstowe', priority: 'medium', status: 'complete', etaInDays: -3 },
  { ref: 'GND-3360', title: 'FTL — Beverages', description: 'Palletised, returnable kegs.', mode: 'ground', origin: 'St. Louis', destination: 'Kansas City', priority: 'low', status: 'complete', etaInDays: -2 },
  { ref: 'RAIL-4530', title: 'Boxcar — Grain', description: 'Bulk agricultural export.', mode: 'rail', origin: 'Omaha', destination: 'New Orleans', priority: 'medium', status: 'complete', etaInDays: -4 },
  { ref: 'OCN-1135', title: 'Reefer — Pharmaceuticals', description: 'Cold-chain, 2–8°C, GDP compliant.', mode: 'ocean', origin: 'Antwerp', destination: 'Singapore', priority: 'critical', status: 'backlog', etaInDays: 24 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Seed tasks anchored to `now`. `count` (default = spec count) lets callers
 * generate a large synthetic board to exercise lane virtualization at scale.
 */
export function createSeedTasks(now: Date = new Date(), count: number = SPECS.length): Task[] {
  const total = Math.max(1, count);
  const keys = generateKeys(total);
  return Array.from({ length: total }, (_, index): Task => {
    const spec = SPECS[index % SPECS.length];
    const cycle = Math.floor(index / SPECS.length);
    const suffix = cycle > 0 ? `-${cycle}` : '';
    return {
      id: `task-${index + 1}`,
      ref: `${spec.ref}${suffix}`,
      title: spec.title,
      description: spec.description,
      mode: spec.mode,
      origin: spec.origin,
      destination: spec.destination,
      priority: spec.priority,
      status: spec.status,
      etaAt: new Date(now.getTime() + spec.etaInDays * DAY_MS).toISOString(),
      updatedAt: now.toISOString(),
      order: keys[index],
    };
  });
}
