import { useState } from 'react';
import type { FormEvent } from 'react';
import { changePassword } from './accountApi';

const inputClass = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

interface Status {
  kind: 'idle' | 'ok' | 'error';
  message?: string;
}

export function AccountPanel({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await changePassword(current, next);
      setStatus({ kind: 'ok', message: 'Password updated.' });
      setCurrent('');
      setNext('');
    } catch {
      setStatus({ kind: 'error', message: 'Could not change password — check your current password.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Account settings"
    >
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Change password</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
            Close
          </button>
        </div>
        <label className="block text-sm">
          <span className="text-slate-600">Current password</span>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-label="Current password" className={inputClass} />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">New password</span>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} aria-label="New password" className={inputClass} />
        </label>
        {status.kind !== 'idle' && (
          <p
            role={status.kind === 'error' ? 'alert' : 'status'}
            className={status.kind === 'error' ? 'text-sm text-red-600' : 'text-sm text-green-600'}
          >
            {status.message}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
