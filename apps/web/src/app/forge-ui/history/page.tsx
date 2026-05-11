'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { AuthModal } from '@/components/AuthModal';

type Mode = 'page' | 'slides';

type HistoryItem = {
  id: string;
  title: string;
  prompt: string;
  mode: Mode;
  isRefine: boolean;
  provider: string;
  model: string;
  createdAt: string;
};

export default function ForgeUiHistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [authOpen, setAuthOpen] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const loadPage = useCallback(async (cursor?: string | null) => {
    const isFirst = !cursor;
    if (isFirst) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (cursor) params.set('cursor', cursor);
      const res = await apiFetch(`/api/ui/generations?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load history');
      setItems((prev) => (isFirst ? data.items : [...prev, ...data.items]));
      setNextCursor(data.nextCursor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- gate-keeping effect: once auth resolves, prompt sign-in for guests.
    if (!authLoading && !user) setAuthOpen(true);
  }, [authLoading, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount; loadPage is the external-system sync.
    if (!authLoading && user) void loadPage();
  }, [authLoading, user, loadPage]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/ui/generations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to delete');
      }
      setItems((prev) => prev.filter((h) => h.id !== id));
      setConfirmDel(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#1a1715] grid place-items-center text-stone-400 text-sm">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-[#1a1715] text-stone-100 grid place-items-center px-6 text-center">
          <div className="max-w-md space-y-3">
            <div className="text-3xl">🗂️</div>
            <h1 className="text-xl font-semibold">Sign in to view your history</h1>
            <p className="text-sm text-stone-400">
              Your past UI generations are saved automatically when you&apos;re signed in.
            </p>
            <button
              onClick={() => setAuthOpen(true)}
              className="h-10 px-4 rounded-lg bg-[#cc785c] text-white text-sm font-medium hover:bg-[#b86a51] transition"
            >
              Sign in
            </button>
          </div>
        </div>
        <AuthModal
          open={authOpen}
          onClose={() => {
            setAuthOpen(false);
            router.push('/forge-ui');
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1715] text-stone-100 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#1a1715]/85 backdrop-blur">
        <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 h-12 sm:h-14">
          <Link href="/forge-ui" className="flex items-center gap-2 select-none shrink-0">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#e89472] to-[#cc785c] grid place-items-center text-white font-bold text-sm">
              ◈
            </div>
            <span className="font-semibold text-base tracking-tight">Forge UI</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-0.5 ml-2">
            <Link
              href="/forge-ui"
              className="h-8 px-3 rounded-md text-sm text-stone-400 hover:bg-white/5 hover:text-stone-100 flex items-center transition"
            >
              Editor
            </Link>
            <span className="h-8 px-3 rounded-md text-sm font-medium bg-white/5 text-stone-100 flex items-center">
              History
            </span>
          </nav>
          <div className="flex-1" />
          <Link
            href="/forge-ui"
            className="h-8 px-3 rounded-md bg-[#cc785c] hover:bg-[#b86a51] text-white text-sm font-medium transition flex items-center gap-1.5"
          >
            <span>＋</span>
            <span>New generation</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Your generations</h1>
          {items.length > 0 && (
            <span className="text-sm text-stone-500">
              {items.length}
              {nextCursor ? '+' : ''}
            </span>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && items.length === 0 && (
          <div className="py-20 text-center text-sm text-stone-500">Loading…</div>
        )}

        {!loading && items.length === 0 && !error && (
          <div className="py-20 text-center space-y-3">
            <div className="text-4xl">🗂️</div>
            <div className="text-base text-stone-300">No generations yet</div>
            <div className="text-sm text-stone-500 max-w-sm mx-auto">
              When you generate a UI in the editor it&apos;s saved here automatically.
            </div>
            <Link
              href="/forge-ui"
              className="inline-flex mt-2 h-10 px-4 rounded-lg bg-[#cc785c] hover:bg-[#b86a51] text-white text-sm font-medium transition items-center"
            >
              Start a generation
            </Link>
          </div>
        )}

        {items.length > 0 && (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((it) => (
              <li key={it.id}>
                <div className="group relative rounded-xl border border-white/8 bg-[#23201d] hover:bg-[#2a2622] hover:border-white/15 transition p-4 h-full flex flex-col">
                  <Link
                    href={`/forge-ui?load=${encodeURIComponent(it.id)}`}
                    className="block flex-1"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-stone-100 truncate">
                          {it.title}
                        </div>
                      </div>
                      <span className="shrink-0 text-[9px] uppercase tracking-wider text-stone-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                        {it.mode}
                      </span>
                    </div>
                    <div className="text-[12px] text-stone-500 line-clamp-3 leading-snug mb-3">
                      {it.prompt}
                    </div>
                    <div className="text-[10px] text-stone-600 flex items-center gap-1.5 mt-auto">
                      {it.isRefine && (
                        <>
                          <span>refine</span>
                          <span>·</span>
                        </>
                      )}
                      <span className="truncate" title={`${it.provider} · ${it.model}`}>
                        {it.provider}
                      </span>
                      <span>·</span>
                      <span>{relativeTime(it.createdAt)}</span>
                    </div>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirmDel === it.id) {
                        void handleDelete(it.id);
                      } else {
                        setConfirmDel(it.id);
                        setTimeout(() => {
                          setConfirmDel((c) => (c === it.id ? null : c));
                        }, 3000);
                      }
                    }}
                    disabled={deletingId === it.id}
                    className={`absolute top-3 right-3 h-6 px-1.5 rounded text-[10px] transition ${
                      confirmDel === it.id
                        ? 'bg-red-500/30 text-red-200 opacity-100'
                        : 'bg-white/5 text-stone-500 hover:text-red-300 hover:bg-red-500/20 opacity-0 group-hover:opacity-100'
                    }`}
                    title={confirmDel === it.id ? 'Click again to confirm' : 'Delete'}
                  >
                    {deletingId === it.id ? '…' : confirmDel === it.id ? 'Sure?' : '✕'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {nextCursor && (
          <div className="mt-6 text-center">
            <button
              onClick={() => void loadPage(nextCursor)}
              disabled={loadingMore}
              className="h-9 px-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-stone-300 hover:text-stone-100 text-sm transition disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
