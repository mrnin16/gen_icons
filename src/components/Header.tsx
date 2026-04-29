'use client';

import { useEffect, useState } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  onOpenGenerator: () => void;
  onOpenBundle: () => void;
};

export function Header({ query, onQueryChange, onOpenGenerator, onOpenBundle }: Props) {
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
      <div className="flex items-center gap-4 px-6 h-16">
        <div className="flex items-center gap-2 select-none">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-violet-700 grid place-items-center text-white font-bold">
            ◈
          </div>
          <span className="font-semibold text-lg tracking-tight">Icon Forge</span>
        </div>

        <div className="flex-1 max-w-2xl mx-auto">
          <div className="relative">
            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Search icons by name, tag, or description…"
              className="w-full h-10 pl-10 pr-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
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

        <button
          onClick={onOpenBundle}
          className="h-10 px-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--bg-elevated)] transition"
          title="Download an installable icon library for your framework"
        >
          📦 Get Package
        </button>
        <button
          onClick={onOpenGenerator}
          className="h-10 px-4 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-white text-sm font-medium hover:from-violet-400 hover:to-violet-600 transition shadow-lg shadow-violet-900/30"
        >
          ✨ Generate with AI
        </button>
      </div>
    </header>
  );
}
