import { useEffect, useState } from 'react';
import { decideRisk, listRiskQueue } from './riskApi';
import type { RiskQueueTask } from './riskApi';

const DECISION_CLS: Record<string, string> = {
  review: 'bg-amber-100 text-amber-700',
  block: 'bg-red-100 text-red-700',
  approve: 'bg-green-100 text-green-700',
};

export function RiskQueue({ onClose }: { onClose: () => void }) {
  const [tasks, setTasks] = useState<RiskQueueTask[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setTasks(await listRiskQueue());
      setError(null);
    } catch {
      setError('Failed to load the risk queue.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function act(taskId: string, action: 'approve' | 'block') {
    try {
      await decideRisk(taskId, action);
      await refresh();
    } catch {
      setError('Action failed.');
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="Risk review queue">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Risk review queue</h2>
            <p className="text-xs text-slate-500">Back-office only — flagged transactions held from the customer.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
            Close
          </button>
        </div>
        {error && (
          <p role="alert" className="mb-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">Shipment</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Decision</th>
                <th className="pb-2">Rules · ML</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-t border-slate-100">
                  <td className="py-2">
                    <span className="font-mono text-xs text-slate-500">{task.ref}</span>
                  </td>
                  <td className="font-mono">
                    {new Intl.NumberFormat(undefined, { style: 'currency', currency: task.transaction.currency, maximumFractionDigits: 0 }).format(task.transaction.amount)}
                  </td>
                  <td>
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${DECISION_CLS[task.transaction.risk.decision] ?? ''}`}>
                      {task.transaction.risk.decision}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500">
                    {task.transaction.risk.reasons.join(', ') || '—'} · {Math.round(task.transaction.risk.score * 100)}%
                  </td>
                  <td className="space-x-2 text-right">
                    <button type="button" onClick={() => act(task.id, 'approve')} className="text-sm font-medium text-green-700 hover:underline">
                      Approve
                    </button>
                    <button type="button" onClick={() => act(task.id, 'block')} className="text-sm font-medium text-red-600 hover:underline">
                      Block
                    </button>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">
                    Queue is clear — no flagged transactions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
