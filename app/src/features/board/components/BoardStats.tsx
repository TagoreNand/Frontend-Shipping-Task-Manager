import { useMemo } from 'react';
import { computeStats } from '../lib/group';
import type { Task } from '../types';

export function BoardStats({ tasks }: { tasks: Task[] }) {
  const stats = useMemo(() => computeStats(tasks), [tasks]);

  const tiles: ReadonlyArray<{ label: string; value: string | number; accent?: boolean }> = [
    { label: 'Total', value: stats.total },
    { label: 'Backlog', value: stats.byStatus.backlog },
    { label: 'In Progress', value: stats.byStatus['in-progress'] },
    { label: 'Complete', value: stats.byStatus.complete },
    { label: 'Critical', value: stats.critical },
    { label: 'AI Flags', value: stats.aiFlags, accent: true },
    { label: 'Completion', value: `${Math.round(stats.completionRate * 100)}%` },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={
            tile.accent
              ? 'rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2'
              : 'rounded-lg border border-slate-200 bg-white px-3 py-2'
          }
        >
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">{tile.label}</dt>
          <dd className="mt-0.5 text-xl font-semibold text-slate-800">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}
