'use client';

import { useEffect, useState } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useAuth } from '@/lib/auth-context';

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  onOpenGenerator: () => void;
  onOpenBundle: () => void;
  onOpenAuth: () => void;
  onOpenSidebar: () => void;
};

export function Header({
  query,
  onQueryChange,
  onOpenGenerator,
  onOpenBundle,
  onOpenAuth,
  onOpenSidebar,
}: Props) {
  const { user, logout } = useAuth();
  const [local, setLocal] = useState(query);
  const debounced = useDebounce(local, 300);

  useEffect(() => {
    if (debounced !== query) onQueryChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    if (query !== local) setLocal(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-primary)]/85 backdrop-blur">
      <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 h-14 sm:h-16">

        {/* Mobile filter toggle */}
        <button
          onClick={onOpenSidebar}
          className="md:hidden w-9 h-9 grid place-items-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] shrink-0"
          aria-label="Open filters"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="20" y2="12" />
            <line x1="12" y1="18" x2="20" y2="18" />
          </svg>
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2 select-none shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-violet-400 to-violet-700 grid place-items-center text-white font-bold text-sm">
            ◈
          </div>
          <span className="font-semibold text-base sm:text-lg tracking-tight hidden xs:block sm:block">
            Icon Forge
          </span>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-0">
          <div className="relative">
            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Search icons…"
              className="w-full h-9 sm:h-10 pl-9 pr-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            {local && (
              <button
                type="button"
                onClick={() => setLocal('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md grid place-items-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Get Package — hidden on xs */}
        <button
          onClick={onOpenBundle}
          className="hidden sm:flex h-9 sm:h-10 px-3 sm:px-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--bg-elevated)] transition shrink-0 items-center gap-1.5"
          title="Download an installable icon library for your framework"
        >
          <span>📦</span>
          <span className="hidden lg:inline">Get Package</span>
        </button>

        {/* Generate */}
        <button
          onClick={onOpenGenerator}
          className="h-9 sm:h-10 px-3 sm:px-4 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-white text-sm font-medium hover:from-violet-400 hover:to-violet-600 transition shadow-lg shadow-violet-900/30 shrink-0 flex items-center gap-1.5"
        >
          <span>✨</span>
          <span className="hidden sm:inline">Generate</span>
        </button>

        {/* Auth */}
        {user ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-[var(--text-muted)] hidden lg:inline truncate max-w-[120px]" title={user.email}>
              {user.name || user.email}
              {user.role === 'ADMIN' && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">ADMIN</span>
              )}
            </span>
            <button
              onClick={() => void logout()}
              className="h-9 sm:h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-sm hover:bg-[var(--bg-elevated)] transition shrink-0"
              title="Sign out"
            >
              <span className="hidden sm:inline">Sign out</span>
              <span className="sm:hidden">↩</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="h-9 sm:h-10 px-3 sm:px-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium hover:bg-[var(--bg-elevated)] transition shrink-0"
          >
            <span className="hidden sm:inline">Sign in</span>
            <span className="sm:hidden">↩</span>
          </button>
        )}
      </div>
    </header>
  );
}
