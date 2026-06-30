import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { MODE_META, PRIORITY_META, laneTitle } from '../constants';
import { hasActionableSuggestion } from '../lib/group';
import type { Task } from '../types';

export const cardClassName = 'rounded-lg border border-slate-200 bg-white p-3 shadow-sm';

const TXN_STATUS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  processing: 'bg-amber-100 text-amber-700',
  cleared: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};
const RISK_DECISION: Record<string, { label: string; cls: string }> = {
  approve: { label: 'Approved', cls: 'bg-green-50 text-green-700' },
  review: { label: 'Review', cls: 'bg-amber-50 text-amber-700' },
  block: { label: 'Blocked', cls: 'bg-red-50 text-red-700' },
};
function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function formatEta(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Presentational card face — shared by the sortable card and the drag overlay. */
function TaskCardFaceComponent({ task }: { task: Task }) {
  const priority = PRIORITY_META[task.priority];
  const mode = MODE_META[task.mode];
  const suggestion = task.aiSuggestion;
  const showSuggestion = suggestion && suggestion.recommendedStatus !== task.status;

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-slate-500">{task.ref}</span>
        <span
          className={clsx(
            'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            priority.className,
          )}
        >
          {priority.label}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{task.title}</h3>
        {task.owner && (
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500" title="Shipment owner">
            {task.owner}
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{task.description}</p>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="rounded bg-slate-100 px-1 py-0.5 font-mono">{mode.code}</span>
          {task.origin} → {task.destination}
        </span>
        <time dateTime={task.etaAt}>ETA {formatEta(task.etaAt)}</time>
      </div>
      {showSuggestion && (
        <div
          className="mt-2 flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700"
          title={`${suggestion.rationale} (${Math.round(suggestion.confidence * 100)}% confidence)`}
        >
          <span className="font-semibold">AI</span>
          <span aria-hidden>▸</span>
          <span>Move to {laneTitle(suggestion.recommendedStatus)}</span>
        </div>
      )}
      {task.transaction && (
        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
          <span className="font-mono text-slate-600">{formatMoney(task.transaction.amount, task.transaction.currency)}</span>
          <span className={clsx('rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide', TXN_STATUS[task.transaction.customerStatus] ?? TXN_STATUS.pending)}>
            {task.transaction.customerStatus}
          </span>
        </div>
      )}
      {task.transaction?.risk && (
        <div
          className={clsx('mt-1 flex items-center gap-1 rounded-md px-2 py-1 text-[11px]', RISK_DECISION[task.transaction.risk.decision]?.cls)}
          title={`rules: ${task.transaction.risk.reasons.join(', ') || 'none'} · ML ${Math.round(task.transaction.risk.score * 100)}%`}
        >
          <span className="font-semibold">RISK</span>
          <span>{RISK_DECISION[task.transaction.risk.decision]?.label}</span>
          <span className="ml-auto font-mono">{Math.round(task.transaction.risk.score * 100)}%</span>
        </div>
      )}
    </>
  );
}

export const TaskCardFace = memo(TaskCardFaceComponent);

export interface TaskCardProps {
  task: Task;
  onApplySuggestion?: (task: Task) => void;
}

function TaskCardComponent({ task, onApplySuggestion }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const canApply = onApplySuggestion !== undefined && hasActionableSuggestion(task);

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-task-id={task.id}
      data-status={task.status}
      className={clsx(
        cardClassName,
        'cursor-grab transition-shadow hover:shadow-md',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500',
        isDragging && 'opacity-40',
      )}
      {...attributes}
      {...listeners}
    >
      <TaskCardFace task={task} />
      {canApply && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={() => onApplySuggestion(task)}
          className="mt-2 w-full rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50"
        >
          Apply AI suggestion
        </button>
      )}
    </article>
  );
}

export const TaskCard = memo(TaskCardComponent);
