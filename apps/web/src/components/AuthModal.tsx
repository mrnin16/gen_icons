'use client';

import { useState } from 'react';

import { useAuth } from '@/lib/auth-context';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AuthModal({ open, onClose }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      onClose();
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Sign in</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            autoComplete="username"
            required
            className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
          />
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full h-10 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-white text-sm font-medium hover:from-violet-400 hover:to-violet-600 disabled:opacity-50"
          >
            {busy ? '…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
