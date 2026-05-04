'use client';

import { CATEGORIES, STYLES } from '@iconforge/shared';
import clsx from 'clsx';

type Props = {
  category: string;
  style: string;
  source: string;
  categoryCounts: Record<string, number>;
  totalCount: number;
  onChange: (patch: { category?: string; style?: string; source?: string }) => void;
  /** Mobile: controlled open state */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function Sidebar({
  category,
  style,
  source,
  categoryCounts,
  totalCount,
  onChange,
  mobileOpen = false,
  onMobileClose,
}: Props) {
  const handleChange = (patch: Parameters<typeof onChange>[0]) => {
    onChange(patch);
    onMobileClose?.();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={clsx(
          // Base layout
          'fixed top-0 left-0 z-40 h-full w-72 overflow-y-auto scroll-thin',
          'border-r border-[var(--border)] bg-[var(--bg-primary)]',
          // Slide transition (mobile)
          'transition-transform duration-300 ease-in-out',
          'md:static md:top-16 md:z-auto md:h-auto md:max-h-[calc(100vh-4rem)]',
          'md:w-60 md:shrink-0 md:self-start md:sticky',
          'md:translate-x-0 md:transition-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 md:hidden">
          <span className="text-sm font-semibold">Filters</span>
          <button
            onClick={onMobileClose}
            className="w-8 h-8 grid place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            aria-label="Close filters"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-6">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Source
            </h3>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
              {[
                { v: '', label: 'All' },
                { v: 'platform', label: 'Pre-built' },
                { v: 'ai', label: 'AI' },
                { v: 'animated', label: '✨ Animated' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => handleChange({ source: opt.v })}
                  className={clsx(
                    'h-8 rounded-md text-xs font-medium transition',
                    source === opt.v
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Categories
            </h3>
            <ul className="space-y-0.5">
              <li>
                <button
                  onClick={() => handleChange({ category: '' })}
                  className={clsx(
                    'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition',
                    category === ''
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]',
                  )}
                >
                  <span>All categories</span>
                  <span className="text-xs text-[var(--text-muted)]">{totalCount}</span>
                </button>
              </li>
              {CATEGORIES.map((cat) => {
                const count = categoryCounts[cat.slug] || 0;
                return (
                  <li key={cat.slug}>
                    <button
                      onClick={() => handleChange({ category: cat.slug })}
                      className={clsx(
                        'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition',
                        category === cat.slug
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base leading-none">{cat.emoji}</span>
                        {cat.label}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Style
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleChange({ style: '' })}
                className={clsx(
                  'h-7 px-2.5 rounded-full border text-xs transition',
                  style === ''
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]',
                )}
              >
                All
              </button>
              {STYLES.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => handleChange({ style: s.slug })}
                  className={clsx(
                    'h-7 px-2.5 rounded-full border text-xs transition',
                    style === s.slug
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
