import { useState } from 'react';
import type { FormEvent } from 'react';
import { login, signup } from './authStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const inputClass = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

export function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('dispatcher');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = mode === 'signin' ? await login(API_BASE, { username, password }) : await signup(API_BASE, { username, password });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong.');
    }
  }

  function switchMode() {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
    setUsername(mode === 'signin' ? '' : 'dispatcher');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Logistics Control Tower</h1>
          <p className="text-sm text-slate-500">{mode === 'signin' ? 'Sign in to access the board.' : 'Create a customer account.'}</p>
        </div>
        <label className="block text-sm">
          <span className="text-slate-600">Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className={inputClass} />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} className={inputClass} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" onClick={switchMode} className="w-full text-center text-xs text-blue-600 hover:underline">
          {mode === 'signin' ? "New here? Create a customer account" : 'Have an account? Sign in'}
        </button>
        {mode === 'signin' && <p className="text-center text-xs text-slate-400">Demo: dispatcher / dev-password · admin / admin-password</p>}
      </form>
    </div>
  );
}
