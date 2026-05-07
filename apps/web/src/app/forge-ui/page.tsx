'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { apiFetch, apiUrl } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { AuthModal } from '@/components/AuthModal';

// ─── Types ───────────────────────────────────────────────────────────────────

type Mode = 'page' | 'slides';
type ViewTab = 'preview' | 'code';

type GenerationData = {
  title: string;
  jsx: string;
  html: string;
  provider: string;
  model: string;
};

type Turn =
  | { id: string; role: 'user'; text: string; mode: Mode; isRefine: boolean }
  | { id: string; role: 'assistant'; status: 'pending' | 'ok' | 'error'; data?: GenerationData; error?: string; sourceUserId?: string };

const STARTERS: { label: string; mode: Mode; prompt: string }[] = [
  {
    label: 'SaaS landing page',
    mode: 'page',
    prompt:
      'A landing page for a developer-focused note-taking app called "Inkwell". Hero with headline + sub + email signup, feature grid (4 cards), pricing teaser, testimonial, footer.',
  },
  {
    label: 'Analytics dashboard',
    mode: 'page',
    prompt:
      'An analytics dashboard for a podcast platform showing this week\'s plays, top episodes, listener geography, retention curve, and a recent activity feed. Use a sidebar nav and a top bar with the user avatar.',
  },
  {
    label: 'Pricing page',
    mode: 'page',
    prompt:
      'A pricing page with three tiers (Starter, Pro, Enterprise). Pro highlighted as recommended. Include feature comparison checkmarks and a billing-period toggle (monthly/yearly).',
  },
  {
    label: 'Pitch deck',
    mode: 'slides',
    prompt:
      'A 6-slide pitch deck for "Lumen", a productivity app that uses AI to schedule deep-work blocks. Title, problem, solution, how it works, traction, ask.',
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ForgeUiPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [authOpen, setAuthOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<Mode>('page');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<ViewTab>('preview');
  const [exporting, setExporting] = useState<'project' | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Latest successful assistant turn — drives the preview pane.
  const current = useMemo<GenerationData | null>(() => {
    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i];
      if (t.role === 'assistant' && t.status === 'ok' && t.data) return t.data;
    }
    return null;
  }, [turns]);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) setAuthOpen(true);
  }, [authLoading, user]);

  // Auto-scroll the chat thread on new turn
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, busy]);

  // Auto-grow the textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    const h = Math.min(ta.scrollHeight, 280);
    ta.style.height = h + 'px';
  }, [draft]);

  const submit = async (overridePrompt?: string, overrideMode?: Mode) => {
    const text = (overridePrompt ?? draft).trim();
    if (!text || busy) return;

    const useMode = overrideMode ?? mode;
    const baseJsx = current?.jsx;
    const isRefine = !!baseJsx;

    const userId = `u_${Date.now()}`;
    const userTurn: Turn = {
      id: userId,
      role: 'user',
      text,
      mode: useMode,
      isRefine,
    };
    const assistantId = `a_${Date.now()}`;
    const assistantPending: Turn = {
      id: assistantId,
      role: 'assistant',
      status: 'pending',
      sourceUserId: userId,
    };

    setTurns((prev) => [...prev, userTurn, assistantPending]);
    setDraft('');
    if (overrideMode) setMode(overrideMode);
    setBusy(true);
    setView('preview');
    setShowPreviewMobile(true);

    try {
      const res = await apiFetch('/api/ui/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, mode: useMode, baseJsx }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Generation failed');
      setTurns((prev) =>
        prev.map((t) =>
          t.id === assistantId
            ? { id: t.id, role: 'assistant', status: 'ok', data: data as GenerationData, sourceUserId: userId }
            : t,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Generation failed';
      setTurns((prev) =>
        prev.map((t) =>
          t.id === assistantId
            ? { id: t.id, role: 'assistant', status: 'error', error: msg, sourceUserId: userId }
            : t,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  // Retry: re-runs the prompt that produced a failed assistant turn. Drops
  // both the user+assistant pair from the thread, then re-submits — that way
  // baseJsx falls back to whatever was current before this failed turn (or
  // null on a first-message failure).
  const retryFromFailure = (failedAssistant: Turn) => {
    if (busy || failedAssistant.role !== 'assistant' || failedAssistant.status !== 'error') return;
    const sourceUser = turns.find(
      (t): t is Extract<Turn, { role: 'user' }> =>
        t.role === 'user' && t.id === failedAssistant.sourceUserId,
    );
    if (!sourceUser) return;
    setTurns((prev) =>
      prev.filter((t) => t.id !== sourceUser.id && t.id !== failedAssistant.id),
    );
    void submit(sourceUser.text, sourceUser.mode);
  };

  const newConversation = () => {
    if (busy) return;
    setTurns([]);
    setDraft('');
    setShowPreviewMobile(false);
  };

  const downloadHtml = () => {
    if (!current) return;
    const blob = new Blob([current.html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(current.title)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadProject = async () => {
    if (!current || exporting) return;
    setExporting('project');
    try {
      const res = await fetch(apiUrl('/api/ui/export-project'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jsx: current.jsx, title: current.title }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug(current.title)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // surfaced via the latest turn already, no need to mutate state
    } finally {
      setExporting(null);
    }
  };

  const copyJsx = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.jsx);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* user can still select-all */
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
            <div className="text-3xl">🎨</div>
            <h1 className="text-xl font-semibold">Forge UI is for signed-in users</h1>
            <p className="text-sm text-stone-400">Sign in to generate pages and slide decks with AI.</p>
            <button
              onClick={() => setAuthOpen(true)}
              className="h-10 px-4 rounded-lg bg-[#cc785c] text-white text-sm font-medium hover:bg-[#b86a51] transition"
            >
              Sign in
            </button>
            <div>
              <Link href="/" className="text-sm text-stone-400 hover:text-stone-100">
                ← Back to icons
              </Link>
            </div>
          </div>
        </div>
        <AuthModal open={authOpen} onClose={() => { setAuthOpen(false); router.push('/'); }} />
      </>
    );
  }

  const hasThread = turns.length > 0;

  return (
    <div className="h-screen flex flex-col bg-[#1a1715] text-stone-100">
      {/* ───── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#1a1715]/85 backdrop-blur">
        <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 h-12 sm:h-14">
          <Link href="/" className="flex items-center gap-2 select-none shrink-0">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#e89472] to-[#cc785c] grid place-items-center text-white font-bold text-sm">
              ◈
            </div>
            <span className="font-semibold text-base tracking-tight hidden xs:block sm:block">
              Forge UI
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-0.5 ml-2">
            <Link
              href="/"
              className="h-8 px-3 rounded-md text-sm text-stone-400 hover:bg-white/5 hover:text-stone-100 flex items-center transition"
            >
              Icons
            </Link>
            <span className="h-8 px-3 rounded-md text-sm font-medium bg-white/5 text-stone-100 flex items-center">
              Forge UI
            </span>
          </nav>

          <div className="flex-1" />

          {hasThread && (
            <button
              onClick={newConversation}
              disabled={busy}
              className="h-8 px-3 rounded-md text-sm border border-white/10 bg-white/5 hover:bg-white/10 text-stone-300 hover:text-stone-100 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>＋</span>
              <span className="hidden sm:inline">New</span>
            </button>
          )}

          {current && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={downloadHtml}
                className="h-8 px-3 rounded-md border border-white/10 bg-white/5 text-stone-300 text-sm hover:bg-white/10 hover:text-stone-100 transition flex items-center gap-1.5"
                title="Download a single self-contained .html file"
              >
                <span>↓</span>
                <span className="hidden md:inline">HTML</span>
              </button>
              <button
                onClick={downloadProject}
                disabled={exporting === 'project'}
                className="h-8 px-3 rounded-md bg-[#cc785c] hover:bg-[#b86a51] text-white text-sm font-medium transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download a runnable Vite + React + Tailwind project"
              >
                <span>{exporting === 'project' ? '…' : '⬇'}</span>
                <span className="hidden md:inline">
                  {exporting === 'project' ? 'Packing…' : 'Project'}
                </span>
              </button>
            </div>
          )}

          <div className="text-xs text-stone-500 hidden lg:block truncate max-w-[140px]" title={user.email}>
            {user.name || user.email}
          </div>
        </div>
      </header>

      {/* ───── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

        {/* Chat column */}
        <section
          className={`${
            showPreviewMobile && current ? 'hidden lg:flex' : 'flex'
          } lg:flex flex-col w-full lg:w-[420px] xl:w-[460px] shrink-0 border-r border-white/5 min-h-0`}
        >
          <div ref={threadRef} className="flex-1 overflow-y-auto scroll-thin">
            {!hasThread ? (
              <Welcome
                mode={mode}
                onPick={(p) => submit(p.prompt, p.mode)}
              />
            ) : (
              <div className="px-4 sm:px-5 py-5 space-y-5 max-w-[640px] mx-auto">
                {turns.map((t) => (
                  <TurnView
                    key={t.id}
                    turn={t}
                    busy={busy}
                    onShow={() => { setView('preview'); setShowPreviewMobile(true); }}
                    onRetry={() => retryFromFailure(t)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-white/5 bg-[#1f1c19] p-3 sm:p-4 shrink-0">
            <div className="max-w-[640px] mx-auto">
              <div className="rounded-xl border border-white/10 bg-[#2a2622] focus-within:border-[#cc785c]/50 transition">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !busy) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  placeholder={
                    hasThread
                      ? 'Ask for a change… (e.g. "make the hero darker", "add a testimonials section")'
                      : mode === 'slides'
                      ? 'Describe a deck — topic, audience, key points…'
                      : 'Describe a UI — page type, sections, content, audience…'
                  }
                  rows={1}
                  className="w-full px-4 pt-3 pb-1 bg-transparent resize-none focus:outline-none text-sm text-stone-100 placeholder:text-stone-500 min-h-[42px]"
                  style={{ maxHeight: 280 }}
                />
                <div className="flex items-center justify-between px-3 pb-2.5 pt-1 gap-2">
                  <div className="flex items-center gap-1.5">
                    <ModeChip
                      label="Page"
                      active={mode === 'page'}
                      onClick={() => setMode('page')}
                      disabled={hasThread}
                    />
                    <ModeChip
                      label="Slides"
                      active={mode === 'slides'}
                      onClick={() => setMode('slides')}
                      disabled={hasThread}
                    />
                  </div>
                  <button
                    onClick={() => void submit()}
                    disabled={busy || !draft.trim()}
                    className="w-8 h-8 rounded-lg bg-[#cc785c] hover:bg-[#b86a51] disabled:opacity-30 disabled:cursor-not-allowed text-white grid place-items-center transition"
                    title={hasThread ? 'Send (Enter)' : 'Generate (Enter)'}
                  >
                    {busy ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              {hasThread && (
                <div className="text-[10px] text-stone-600 mt-1.5 px-1">
                  Mode is locked once a conversation starts. Use <span className="text-stone-400">＋ New</span> for a different mode.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Preview column */}
        <section
          className={`${
            showPreviewMobile && current ? 'flex' : 'hidden'
          } lg:flex flex-col flex-1 min-h-0 min-w-0 bg-[#0e0c0b]`}
        >
          {/* Preview top bar */}
          <div className="flex items-center gap-2 border-b border-white/5 px-3 sm:px-5 h-11 bg-[#1a1715] shrink-0">
            <button
              onClick={() => setShowPreviewMobile(false)}
              className="lg:hidden h-7 px-2 rounded text-xs text-stone-400 hover:text-stone-100 hover:bg-white/5 transition flex items-center gap-1"
            >
              ← Chat
            </button>

            <div className="inline-flex p-0.5 rounded-md bg-white/5 border border-white/5">
              <button
                onClick={() => setView('preview')}
                disabled={!current}
                className={`px-3 h-7 rounded text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  view === 'preview' && current
                    ? 'bg-[#cc785c] text-white'
                    : 'text-stone-400 hover:text-stone-100'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setView('code')}
                disabled={!current}
                className={`px-3 h-7 rounded text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  view === 'code' && current
                    ? 'bg-[#cc785c] text-white'
                    : 'text-stone-400 hover:text-stone-100'
                }`}
              >
                Code
              </button>
            </div>

            {current && (
              <span className="text-xs text-stone-500 truncate hidden sm:inline" title={current.title}>
                · {current.title}
              </span>
            )}

            <div className="flex-1" />

            {current && view === 'code' && (
              <button
                onClick={copyJsx}
                className="h-7 px-2.5 rounded text-[11px] text-stone-300 hover:text-stone-100 bg-white/5 hover:bg-white/10 border border-white/5 transition flex items-center gap-1"
              >
                {copied ? '✓ Copied' : 'Copy JSX'}
              </button>
            )}
          </div>

          {/* Preview body */}
          <div className="flex-1 min-h-0 relative">
            {!current && !busy && (
              <div className="absolute inset-0 grid place-items-center px-6">
                <div className="max-w-md text-center space-y-2">
                  <div className="text-4xl">🎨</div>
                  <h2 className="text-base font-semibold">No preview yet</h2>
                  <p className="text-sm text-stone-500">
                    Send a prompt on the left and the generated UI will render here.
                  </p>
                </div>
              </div>
            )}
            {busy && !current && <LoadingForge mode={mode} />}
            {current && view === 'preview' && (
              <iframe
                key={current.jsx.length + ':' + current.title}
                title="Preview"
                srcDoc={current.html}
                sandbox="allow-scripts"
                className="absolute inset-0 w-full h-full bg-white"
              />
            )}
            {busy && current && (
              <div className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-lg bg-[#1a1715]/90 border border-white/10 text-[11px] text-stone-300 flex items-center gap-2 shadow-lg">
                <span className="w-3 h-3 border-2 border-stone-500 border-t-[#cc785c] rounded-full animate-spin" />
                Updating preview…
              </div>
            )}
            {current && view === 'code' && (
              <div className="absolute inset-0 overflow-auto scroll-thin bg-[#0e0c0b]">
                <pre className="p-4 sm:p-6 text-[12px] leading-relaxed font-mono text-stone-200 whitespace-pre">
{current.jsx}
                </pre>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function ModeChip({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-6 px-2 rounded-md text-[11px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? 'bg-[#cc785c]/20 text-[#e89472] border border-[#cc785c]/40'
          : 'text-stone-500 hover:text-stone-300 border border-transparent'
      }`}
    >
      {label}
    </button>
  );
}

function TurnView({
  turn,
  busy,
  onShow,
  onRetry,
}: {
  turn: Turn;
  busy: boolean;
  onShow: () => void;
  onRetry: () => void;
}) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#cc785c]/15 border border-[#cc785c]/25 px-3.5 py-2.5 text-sm text-stone-100 whitespace-pre-wrap">
          {turn.text}
          <div className="text-[10px] text-stone-500 mt-1.5 flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 uppercase tracking-wider">
              {turn.mode}
            </span>
            {turn.isRefine && <span className="text-stone-400">refine</span>}
          </div>
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#e89472] to-[#cc785c] grid place-items-center text-white text-sm font-bold mt-0.5">
        ◈
      </div>
      <div className="flex-1 min-w-0">
        {turn.status === 'pending' && <ThinkingBubble />}
        {turn.status === 'ok' && turn.data && (
          <button
            onClick={onShow}
            className="w-full text-left rounded-xl border border-white/10 bg-[#23201d] hover:bg-[#2a2622] hover:border-white/20 px-3.5 py-3 transition group"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-100 truncate">
                  {turn.data.title}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5 truncate">
                  via {turn.data.provider} · {turn.data.model}
                </div>
              </div>
              <div className="shrink-0 text-[11px] text-stone-500 group-hover:text-[#e89472] transition flex items-center gap-1 mt-0.5">
                Show
                <span>→</span>
              </div>
            </div>
          </button>
        )}
        {turn.status === 'error' && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-300 space-y-2.5">
            <div>
              <div className="font-medium mb-0.5">Generation failed</div>
              <div className="text-[12px] text-red-300/80">{turn.error}</div>
            </div>
            <button
              onClick={onRetry}
              disabled={busy}
              className="h-7 px-2.5 rounded-md bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-[12px] font-medium text-red-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <span>↻</span>
              <span>Try again</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  const messages = ['Thinking…', 'Sketching layout…', 'Picking palette…', 'Wiring interactions…'];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % messages.length), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="rounded-xl border border-white/10 bg-[#23201d] px-3.5 py-3 inline-flex items-center gap-2">
      <span className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-forge-dot" />
        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-forge-dot [animation-delay:0.18s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-forge-dot [animation-delay:0.36s]" />
      </span>
      <span key={idx} className="text-sm text-stone-300 animate-forge-fade-in">
        {messages[idx]}
      </span>
      <style>{`
        @keyframes forge-dot { 0%,80%,100% { opacity: 0.25; transform: scale(1); } 40% { opacity: 1; transform: scale(1.4); } }
        @keyframes forge-fade-in { 0% { opacity: 0; transform: translateY(3px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-forge-dot { animation: forge-dot 1.2s ease-in-out infinite; }
        .animate-forge-fade-in { animation: forge-fade-in 0.4s ease-out; }
      `}</style>
    </div>
  );
}

function Welcome({
  mode,
  onPick,
}: {
  mode: Mode;
  onPick: (p: (typeof STARTERS)[number]) => void;
}) {
  return (
    <div className="px-5 py-10 sm:py-16 max-w-[640px] mx-auto space-y-8">
      <div className="space-y-2 text-center">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-[#e89472] to-[#cc785c] items-center justify-center text-white text-2xl font-bold">
          ◈
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-stone-100">
          What should we build?
        </h1>
        <p className="text-sm text-stone-400 max-w-md mx-auto">
          Describe a page or slide deck. Get back a real React + Tailwind component you can preview, refine, and export.
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-stone-500 px-1">Try one of these</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {STARTERS.map((s) => (
            <button
              key={s.label}
              onClick={() => onPick(s)}
              className="text-left rounded-xl border border-white/8 bg-[#23201d] hover:bg-[#2a2622] hover:border-white/15 px-3.5 py-3 transition group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-stone-100 group-hover:text-white">
                  {s.label}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-stone-500 group-hover:text-[#e89472] px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                  {s.mode}
                </span>
              </div>
              <div className="text-[12px] text-stone-500 line-clamp-2 leading-snug">
                {s.prompt}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-stone-600 text-center">
        Currently selected mode:{' '}
        <span className="text-stone-400 font-medium">{mode === 'slides' ? 'Slides' : 'Page'}</span>
        {' '}— change it in the composer below.
      </div>
    </div>
  );
}

// ─── Loading wireframe (preview pane, first generation) ──────────────────────

const PAGE_STATUSES = [
  '✨ Sketching layout…',
  '🎨 Picking the palette…',
  '🧱 Placing components…',
  '📐 Tightening spacing…',
  '🪶 Choosing the typography…',
  '🔧 Wiring up interactions…',
  '✅ Polishing the edges…',
];

const SLIDE_STATUSES = [
  '🎬 Outlining the deck…',
  '✏️ Drafting the title slide…',
  '📊 Composing the data slide…',
  '💬 Writing the closing line…',
  '🎨 Picking the palette…',
  '🪶 Choosing the typography…',
  '✨ Adding the polish…',
];

function LoadingForge({ mode }: { mode: Mode }) {
  const [statusIdx, setStatusIdx] = useState(0);
  const statuses = mode === 'slides' ? SLIDE_STATUSES : PAGE_STATUSES;

  useEffect(() => {
    const id = setInterval(() => {
      setStatusIdx((i) => (i + 1) % statuses.length);
    }, 2200);
    return () => clearInterval(id);
  }, [statuses.length]);

  return (
    <div className="absolute inset-0 grid place-items-center bg-[#0e0c0b] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full bg-[#cc785c]/25 blur-3xl animate-forge-pulse" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 px-6">
        {mode === 'slides' ? <SlidesWireframe /> : <PageWireframe />}

        <div className="space-y-2 text-center">
          <div key={statusIdx} className="text-sm text-stone-200 font-medium animate-forge-fade-in">
            {statuses[statusIdx]}
          </div>
          <div className="text-[11px] text-stone-500 flex items-center justify-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#e89472] animate-forge-dot" />
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#e89472] animate-forge-dot [animation-delay:0.18s]" />
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#e89472] animate-forge-dot [animation-delay:0.36s]" />
            <span className="ml-1">typically 10–30 seconds</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes forge-draw { from { stroke-dashoffset: var(--len, 200); } to { stroke-dashoffset: 0; } }
        @keyframes forge-fill-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes forge-pulse { 0%,100% { opacity: 0.35; transform: translate(-50%, 0) scale(1); } 50% { opacity: 0.6; transform: translate(-50%, 0) scale(1.08); } }
        @keyframes forge-fade-in { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes forge-dot { 0%,80%,100% { opacity: 0.25; transform: scale(1); } 40% { opacity: 1; transform: scale(1.4); } }
        .forge-draw { stroke-dasharray: var(--len); stroke-dashoffset: var(--len); animation: forge-draw 1.2s cubic-bezier(0.16,1,0.3,1) infinite alternate; }
        .forge-fill { transform-origin: left center; animation: forge-fill-grow 1.6s cubic-bezier(0.16,1,0.3,1) infinite alternate; }
        .animate-forge-pulse { animation: forge-pulse 3s ease-in-out infinite; }
        .animate-forge-fade-in { animation: forge-fade-in 0.5s ease-out; }
        .animate-forge-dot { animation: forge-dot 1.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function PageWireframe() {
  const stroke = 'rgba(232, 148, 114, 0.85)';
  const fill = 'rgba(232, 148, 114, 0.18)';
  return (
    <svg width="320" height="200" viewBox="0 0 320 200" fill="none">
      <rect x="10" y="10" width="300" height="22" rx="4" stroke={stroke} strokeWidth="1.5"
        className="forge-draw" style={{ ['--len' as string]: '650' } as React.CSSProperties} />
      <circle cx="22" cy="21" r="4" fill={stroke} />
      <rect x="32" y="18" width="42" height="6" rx="2" fill={fill} />
      <rect x="240" y="17" width="60" height="8" rx="2" fill={fill} />

      <rect x="10" y="42" width="300" height="58" rx="4" stroke={stroke} strokeWidth="1.5"
        className="forge-draw" style={{ ['--len' as string]: '720', animationDelay: '0.15s' } as React.CSSProperties} />
      <rect x="22" y="56" width="180" height="8" rx="2" fill={stroke}
        className="forge-fill" style={{ animationDelay: '0.2s' } as React.CSSProperties} />
      <rect x="22" y="70" width="240" height="5" rx="2" fill={fill}
        className="forge-fill" style={{ animationDelay: '0.35s' } as React.CSSProperties} />
      <rect x="22" y="80" width="200" height="5" rx="2" fill={fill}
        className="forge-fill" style={{ animationDelay: '0.45s' } as React.CSSProperties} />

      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={10 + i * 102} y={110} width="96" height="50" rx="4" stroke={stroke} strokeWidth="1.5"
            className="forge-draw"
            style={{ ['--len' as string]: '290', animationDelay: `${0.4 + i * 0.12}s` } as React.CSSProperties} />
          <circle cx={20 + i * 102} cy={122} r="4" fill={fill} />
          <rect x={28 + i * 102} y={119} width="48" height="6" rx="2" fill={fill} />
          <rect x={20 + i * 102} y={138} width="76" height="4" rx="2" fill={fill} />
          <rect x={20 + i * 102} y={146} width="60" height="4" rx="2" fill={fill} />
        </g>
      ))}

      <rect x="10" y="170" width="300" height="20" rx="4" stroke={stroke} strokeWidth="1.5"
        className="forge-draw" style={{ ['--len' as string]: '650', animationDelay: '0.8s' } as React.CSSProperties} />
    </svg>
  );
}

function SlidesWireframe() {
  const stroke = 'rgba(232, 148, 114, 0.85)';
  const fill = 'rgba(232, 148, 114, 0.18)';
  const slides = [
    { kind: 'title' as const, titleW: 110 },
    { kind: 'agenda' as const, titleW: 60 },
    { kind: 'data' as const, titleW: 80 },
    { kind: 'closing' as const, titleW: 90 },
  ];
  return (
    <svg width="320" height="200" viewBox="0 0 320 200" fill="none">
      {slides.map((s, i) => {
        const x = 10 + i * 78;
        return (
          <g key={i}>
            <rect x={x} y={20} width="68" height="100" rx="4" stroke={stroke} strokeWidth="1.5"
              className="forge-draw"
              style={{ ['--len' as string]: '345', animationDelay: `${i * 0.18}s` } as React.CSSProperties} />
            {s.kind === 'title' && (
              <>
                <rect x={x + 10} y={50} width={s.titleW * 0.5} height="6" rx="2" fill={stroke}
                  className="forge-fill" style={{ animationDelay: `${i * 0.18 + 0.15}s` } as React.CSSProperties} />
                <rect x={x + 10} y={60} width={s.titleW * 0.35} height="4" rx="2" fill={fill}
                  className="forge-fill" style={{ animationDelay: `${i * 0.18 + 0.25}s` } as React.CSSProperties} />
                <circle cx={x + 16} cy={100} r="3" fill={fill} />
                <rect x={x + 22} y={97} width={20} height="4" rx="2" fill={fill} />
              </>
            )}
            {s.kind === 'agenda' && [0, 1, 2, 3].map((j) => (
              <rect key={j} x={x + 10} y={45 + j * 14} width={48} height="4" rx="2" fill={fill}
                className="forge-fill" style={{ animationDelay: `${i * 0.18 + j * 0.05}s` } as React.CSSProperties} />
            ))}
            {s.kind === 'data' && (
              <>
                {[16, 22, 14, 28, 12].map((h, j) => (
                  <rect key={j} x={x + 12 + j * 10} y={108 - h} width={6} height={h} rx="1" fill={stroke}
                    className="forge-fill" style={{ animationDelay: `${i * 0.18 + j * 0.07}s` } as React.CSSProperties} />
                ))}
                <line x1={x + 10} y1={108} x2={x + 60} y2={108} stroke={fill} strokeWidth="1" />
              </>
            )}
            {s.kind === 'closing' && (
              <>
                <rect x={x + 12} y={55} width={s.titleW * 0.5} height="6" rx="2" fill={stroke}
                  className="forge-fill" style={{ animationDelay: `${i * 0.18 + 0.15}s` } as React.CSSProperties} />
                <rect x={x + 12} y={70} width={42} height="3" rx="1" fill={fill} />
                <rect x={x + 12} y={78} width={36} height="3" rx="1" fill={fill} />
                <rect x={x + 12} y={92} width={22} height="10" rx="2" fill={stroke} fillOpacity="0.6" />
              </>
            )}
          </g>
        );
      })}

      <g transform="translate(146, 152)">
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} cx={i * 10} cy={0} r="3" fill={fill}
            className="forge-fill"
            style={{ animationDelay: `${0.5 + i * 0.18}s`, transformOrigin: `${i * 10}px 0` } as React.CSSProperties} />
        ))}
      </g>
    </svg>
  );
}

// ─── Util ────────────────────────────────────────────────────────────────────

function slug(s: string): string {
  return (s || 'forge-ui')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'forge-ui';
}
