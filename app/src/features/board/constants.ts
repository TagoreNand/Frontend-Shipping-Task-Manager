import type { Priority, ShipMode, TaskStatus } from './types';

export interface LaneMeta {
  id: TaskStatus;
  title: string;
  surface: string;
  heading: string;
  dot: string;
}

export const LANES: readonly LaneMeta[] = [
  { id: 'backlog', title: 'Backlog', surface: 'bg-slate-50', heading: 'text-slate-700', dot: 'bg-slate-400' },
  { id: 'in-progress', title: 'In Progress', surface: 'bg-blue-50', heading: 'text-blue-700', dot: 'bg-blue-500' },
  { id: 'complete', title: 'Complete', surface: 'bg-green-50', heading: 'text-green-700', dot: 'bg-green-500' },
] as const;

export function laneTitle(status: TaskStatus): string {
  return LANES.find((lane) => lane.id === status)?.title ?? status;
}

/** Lanes longer than this switch to a windowed (virtualized) renderer. */
export const VIRTUALIZE_THRESHOLD = 30;

export function shouldVirtualize(count: number): boolean {
  return count > VIRTUALIZE_THRESHOLD;
}

export const PRIORITY_META: Record<Priority, { label: string; className: string; weight: number }> = {
  low: { label: 'Low', className: 'bg-slate-100 text-slate-600', weight: 0 },
  medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700', weight: 1 },
  high: { label: 'High', className: 'bg-orange-100 text-orange-700', weight: 2 },
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700', weight: 3 },
};

export const MODE_META: Record<ShipMode, { label: string; code: string }> = {
  ocean: { label: 'Ocean Freight', code: 'OCN' },
  air: { label: 'Air Freight', code: 'AIR' },
  rail: { label: 'Rail Freight', code: 'RAIL' },
  ground: { label: 'Ground', code: 'GND' },
};
