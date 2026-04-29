'use client';

import clsx from 'clsx';

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

function buildRange(page: number, totalPages: number): (number | '…')[] {
  const out: (number | '…')[] = [];
  const push = (n: number | '…') => out.push(n);

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) push(i);
    return out;
  }
  push(1);
  if (page > 4) push('…');
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) push(i);
  if (page < totalPages - 3) push('…');
  push(totalPages);
  return out;
}

export function Pagination({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;
  const range = buildRange(page, totalPages);

  const btn = (n: number, label: string, disabled = false) => (
    <button
      onClick={() => !disabled && onPageChange(n)}
      disabled={disabled}
      className={clsx(
        'h-9 min-w-9 px-3 rounded-md text-sm border transition',
        disabled
          ? 'border-transparent text-[var(--text-muted)] cursor-not-allowed'
          : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]',
      )}
    >
      {label}
    </button>
  );

  return (
    <nav className="flex items-center gap-1 justify-center mt-8">
      {btn(Math.max(1, page - 1), '←', page === 1)}
      {range.map((r, i) =>
        r === '…' ? (
          <span key={`d-${i}`} className="px-2 text-[var(--text-muted)]">
            …
          </span>
        ) : (
          <button
            key={r}
            onClick={() => onPageChange(r)}
            className={clsx(
              'h-9 min-w-9 rounded-md text-sm transition',
              r === page
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]',
            )}
          >
            {r}
          </button>
        ),
      )}
      {btn(Math.min(totalPages, page + 1), '→', page === totalPages)}
    </nav>
  );
}
