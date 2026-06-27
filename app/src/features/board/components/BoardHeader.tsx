import { useState } from 'react';
import clsx from 'clsx';
import { requiresAuth, useAuthStore } from '@/features/auth/authStore';
import { UsersAdmin } from '@/features/users/UsersAdmin';
import { AccountPanel } from '@/features/account/AccountPanel';
import { AuditPanel } from '@/features/audit/AuditPanel';
import { useBoardRealtime } from '../hooks/useBoardRealtime';
import type { ConnectionStatus } from '../hooks/useBoardRealtime';

const STATUS_UI: Record<ConnectionStatus, { label: string; dot: string; pulse: boolean }> = {
  connecting: { label: 'Connecting…', dot: 'bg-amber-400', pulse: false },
  live: { label: 'Live', dot: 'bg-green-500', pulse: true },
  reconnecting: { label: 'Reconnecting…', dot: 'bg-amber-500', pulse: true },
  offline: { label: 'Offline', dot: 'bg-red-500', pulse: false },
};

const pill = 'rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50';

export function BoardHeader() {
  const { status, lastSyncAt } = useBoardRealtime();
  const ui = STATUS_UI[status];
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const logout = useAuthStore((state) => state.logout);
  const [adminOpen, setAdminOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Logistics Control Tower</h1>
        <p className="text-sm text-slate-500">Drag shipping tasks across lanes to update fulfilment status.</p>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
          role="status"
          aria-live="polite"
        >
          <span className={clsx('h-2 w-2 rounded-full', ui.dot, ui.pulse && 'animate-pulseDot')} aria-hidden />
          {ui.label}
          {lastSyncAt && (
            <span className="text-slate-400">
              · synced {new Date(lastSyncAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        {requiresAuth && role === 'admin' && (
          <button type="button" onClick={() => setAdminOpen(true)} className={pill}>
            Users
          </button>
        )}
        {requiresAuth && role === 'admin' && (
          <button type="button" onClick={() => setAuditOpen(true)} className={pill}>
            Audit
          </button>
        )}
        {requiresAuth && user && (
          <button type="button" onClick={() => setAccountOpen(true)} className={pill}>
            Account
          </button>
        )}
        {requiresAuth && user && (
          <button type="button" onClick={logout} className={pill}>
            {user} · Sign out
          </button>
        )}
      </div>
      {adminOpen && <UsersAdmin onClose={() => setAdminOpen(false)} />}
      {accountOpen && <AccountPanel onClose={() => setAccountOpen(false)} />}
      {auditOpen && <AuditPanel onClose={() => setAuditOpen(false)} />}
    </header>
  );
}
