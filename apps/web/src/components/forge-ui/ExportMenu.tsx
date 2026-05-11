'use client';

import { useEffect, useRef, useState } from 'react';

export type ExportKind = 'html' | 'project' | 'png' | 'gif' | 'video';

type ExportState =
  | { kind: ExportKind; stage: string; pct?: number }
  | null;

const ITEMS: { id: ExportKind; label: string; sub: string; icon: string; posterOnly?: boolean }[] = [
  { id: 'html', label: 'HTML file', sub: 'Self-contained .html', icon: '↓' },
  { id: 'project', label: 'Vite project', sub: 'React + Tailwind .zip', icon: '⬇' },
  { id: 'png', label: 'PNG image', sub: 'Static social post', icon: '◰', posterOnly: true },
  { id: 'gif', label: 'Animated GIF', sub: '3s loop · 720p', icon: '◑', posterOnly: true },
  { id: 'video', label: 'Video (WebM/MP4)', sub: '4s · 15fps', icon: '▶', posterOnly: true },
];

export function ExportMenu({
  isPoster,
  busy,
  onPick,
}: {
  isPoster: boolean;
  busy: ExportState;
  onPick: (kind: ExportKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visibleItems = ITEMS.filter((it) => !it.posterOnly || isPoster);
  const isBusy = !!busy;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isBusy}
        className="h-8 px-3 rounded-md bg-[#cc785c] hover:bg-[#b86a51] text-white text-sm font-medium transition flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-wait"
      >
        {isBusy ? (
          <>
            <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            <span className="hidden md:inline">
              {labelFor(busy?.kind)}
              {typeof busy?.pct === 'number' && ` ${Math.round(busy.pct * 100)}%`}
            </span>
          </>
        ) : (
          <>
            <span>⬇</span>
            <span className="hidden md:inline">Export</span>
            <span className="hidden md:inline text-white/70">▾</span>
          </>
        )}
      </button>

      {open && !isBusy && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-white/10 bg-[#1f1c19]/95 backdrop-blur shadow-2xl overflow-hidden z-50 animate-forge-menu-in"
        >
          {visibleItems.map((it) => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPick(it.id);
              }}
              className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-white/5 transition"
            >
              <span className="w-7 h-7 rounded-md bg-white/5 border border-white/5 grid place-items-center text-stone-400 group-hover:text-[#e89472] text-base shrink-0">
                {it.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-stone-100 font-medium truncate">{it.label}</span>
                <span className="block text-[11px] text-stone-500 truncate">{it.sub}</span>
              </span>
            </button>
          ))}
          <style>{`
            @keyframes forge-menu-in { 0% { opacity: 0; transform: translateY(-6px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            .animate-forge-menu-in { animation: forge-menu-in 0.16s cubic-bezier(0.16,1,0.3,1); transform-origin: top right; }
          `}</style>
        </div>
      )}
    </div>
  );
}

function labelFor(kind: ExportKind | undefined): string {
  switch (kind) {
    case 'html': return 'HTML…';
    case 'project': return 'Packing…';
    case 'png': return 'PNG…';
    case 'gif': return 'GIF…';
    case 'video': return 'Video…';
    default: return 'Working…';
  }
}
