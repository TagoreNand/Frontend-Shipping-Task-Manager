import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { listAudit } from './auditApi';
import type { AuditEntry } from './auditApi';

const inputClass = 'rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none';

export function AuditPanel({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setEntries(await listAudit({ actor: actor || undefined, action: action || undefined }));
      setError(null);
    } catch {
      setError('Failed to load the audit log.');
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onApply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void refresh();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Audit log"
    >
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Audit log</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
            Close
          </button>
        </div>
        <form onSubmit={onApply} className="mb-3 flex flex-wrap items-center gap-2">
          <input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="actor" aria-label="Filter by actor" className={inputClass} />
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="action (e.g. user.create)" aria-label="Filter by action" className={inputClass} />
          <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Apply
          </button>
        </form>
        {error && (
          <p role="alert" className="mb-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">Time</th>
                <th className="pb-2">Actor</th>
                <th className="pb-2">Action</th>
                <th className="pb-2">Target</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-100">
                  <td className="py-1.5 font-mono text-xs text-slate-500">{new Date(entry.at).toLocaleString()}</td>
                  <td>{entry.actor}</td>
                  <td className="font-medium text-slate-700">{entry.action}</td>
                  <td className="text-slate-500">{entry.target ?? '—'}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-400">
                    No matching audit entries.
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
