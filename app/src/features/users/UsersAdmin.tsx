import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createUser, deleteUser, listUsers, updateUserRole } from './usersApi';
import type { AdminUser } from './usersApi';

const ROLES = ['dispatcher', 'admin'];
const inputClass = 'rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none';

export function UsersAdmin({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ username: string; password: string; role: string }>({
    username: '',
    password: '',
    role: 'dispatcher',
  });

  async function refresh() {
    try {
      setUsers(await listUsers());
      setError(null);
    } catch {
      setError('Failed to load users.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createUser(form);
      setForm({ username: '', password: '', role: 'dispatcher' });
      await refresh();
    } catch {
      setError('Could not create user — the username may be taken.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="User management"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Users &amp; roles</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
            Close
          </button>
        </div>
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-600">
            {error}
          </p>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2">User</th>
              <th className="pb-2">Role</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100">
                <td className="py-2">
                  {user.displayName} <span className="text-slate-400">@{user.username}</span>
                </td>
                <td>
                  <select
                    value={user.role}
                    aria-label={`Role for ${user.username}`}
                    className={inputClass}
                    onChange={(event) => {
                      void updateUserRole(user.id, event.target.value).then(refresh);
                    }}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    aria-label={`Delete ${user.username}`}
                    className="text-sm font-medium text-red-600 hover:underline"
                    onClick={() => {
                      void deleteUser(user.id).then(refresh);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={onCreate} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
          <input
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            placeholder="username"
            aria-label="New username"
            className={inputClass}
          />
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="password"
            aria-label="New password"
            className={inputClass}
          />
          <select
            value={form.role}
            aria-label="New role"
            className={inputClass}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Add user
          </button>
        </form>
      </div>
    </div>
  );
}
