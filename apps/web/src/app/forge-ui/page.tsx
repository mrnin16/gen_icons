'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { apiFetch, apiUrl } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { AuthModal } from '@/components/AuthModal';

type Mode = 'page' | 'slides';
type ViewTab = 'preview' | 'code';

type GenerateResponse = {
  title: string;
  jsx: string;
  html: string;
  provider: string;
  model: string;
};

const EXAMPLES: { label: string; mode: Mode; prompt: string }[] = [
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
  {
    label: 'Quarterly review deck',
    mode: 'slides',
    prompt:
      'A 6-slide quarterly review for an e-commerce team: quarter overview, KPIs, top wins, top challenges, customer quote, next quarter focus.',
  },
];

export default function ForgeUiPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [authOpen, setAuthOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<Mode>('page');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [view, setView] = useState<ViewTab>('preview');
  const [exporting, setExporting] = useState<'html' | 'project' | null>(null);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auth gate: redirect to home + open auth modal once we know the user is null.
  useEffect(() => {
    if (!authLoading && !user) {
      setAuthOpen(true);
    }
  }, [authLoading, user]);

  const previewSrcDoc = useMemo(() => result?.html ?? null, [result]);

  const submit = async () => {
    const p = prompt.trim();
    if (!p || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch('/api/ui/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Generation failed');
      setResult(data as GenerateResponse);
      setView('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadHtml = () => {
    if (!result) return;
    const blob = new Blob([result.html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(result.title)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadProject = async () => {
    if (!result || exporting) return;
    setExporting('project');
    try {
      const res = await fetch(apiUrl('/api/ui/export-project'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jsx: result.jsx, title: result.title }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug(result.title)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const copyJsx = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.jsx);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — user can still select-all
    }
  };

  // Render skeleton + auth modal while we don't have a user yet
  if (authLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-[var(--text-muted)] text-sm">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="min-h-screen grid place-items-center px-6 text-center">
          <div className="max-w-md space-y-3">
            <div className="text-3xl">🎨</div>
            <h1 className="text-xl font-semibold">Forge UI is for signed-in users</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Sign in to generate pages and slide decks with AI.
            </p>
            <button
              onClick={() => setAuthOpen(true)}
              className="h-10 px-4 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-white text-sm font-medium hover:from-violet-400 hover:to-violet-600 transition shadow-lg shadow-violet-900/30"
            >
              Sign in
            </button>
            <div>
              <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                ← Back to icons
              </Link>
            </div>
          </div>
        </div>
        <AuthModal open={authOpen} onClose={() => { setAuthOpen(false); router.push('/'); }} />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)]">
      {/* ───── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-primary)]/85 backdrop-blur">
        <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-6 h-14 sm:h-16">
          <Link href="/" className="flex items-center gap-2 select-none shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-gradient-to-br from-violet-400 to-violet-700 grid place-items-center text-white font-bold text-sm">
              ◈
            </div>
            <span className="font-semibold text-base sm:text-lg tracking-tight hidden xs:block sm:block">
              Forge UI
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1 ml-2">
            <Link
              href="/"
              className="h-9 px-3 rounded-md text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] flex items-center"
            >
              Icons
            </Link>
            <span className="h-9 px-3 rounded-md text-sm font-medium bg-[var(--bg-elevated)] text-[var(--text-primary)] flex items-center">
              Forge UI
            </span>
          </nav>

          <div className="flex-1" />

          {result && (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <button
                onClick={downloadHtml}
                className="h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] text-sm hover:bg-[var(--bg-elevated)] transition flex items-center gap-1.5"
                title="Download a single self-contained .html file"
              >
                <span>↓</span>
                <span className="hidden md:inline">Export HTML</span>
              </button>
              <button
                onClick={downloadProject}
                disabled={exporting === 'project'}
                className="h-9 px-3 rounded-md bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-sm font-medium hover:from-emerald-400 hover:to-emerald-600 transition shadow-lg shadow-emerald-900/20 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download a runnable Vite + React + Tailwind project as a .zip"
              >
                <span>{exporting === 'project' ? '…' : '⬇'}</span>
                <span className="hidden md:inline">
                  {exporting === 'project' ? 'Packing…' : 'Export Project'}
                </span>
              </button>
            </div>
          )}

          <div className="text-xs text-[var(--text-muted)] hidden lg:block truncate max-w-[160px]" title={user.email}>
            {user.name || user.email}
          </div>
        </div>
      </header>

      {/* ───── Main: prompt panel + workspace ─────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">

        {/* Prompt panel */}
        <aside className="lg:w-[360px] xl:w-[400px] shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--border)] bg-[var(--bg-surface)]/40 overflow-y-auto scroll-thin">
          <div className="p-4 sm:p-5 space-y-5">

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-2">
                Mode
              </label>
              <div className="inline-flex p-1 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)]">
                <button
                  onClick={() => setMode('page')}
                  className={`px-3 h-8 rounded text-sm font-medium transition ${
                    mode === 'page'
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Page
                </button>
                <button
                  onClick={() => setMode('slides')}
                  className={`px-3 h-8 rounded text-sm font-medium transition ${
                    mode === 'slides'
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Slides
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-2">
                {mode === 'page'
                  ? 'A single, focused web page (landing, dashboard, pricing…).'
                  : 'A 5–7 slide deck with vertical scroll-snap and a slide indicator.'}
              </p>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-2">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 600))}
                placeholder={
                  mode === 'page'
                    ? 'Describe the page — layout, sections, content, audience…'
                    : 'Describe the deck — topic, audience, slide count, key points…'
                }
                className="w-full h-40 p-3 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] resize-none"
              />
              <div className="text-right text-[10px] text-[var(--text-muted)] mt-1">
                {prompt.length}/600
              </div>
            </div>

            <button
              onClick={submit}
              disabled={busy || !prompt.trim()}
              className="w-full h-11 rounded-md bg-gradient-to-br from-violet-500 to-violet-700 text-white text-sm font-medium hover:from-violet-400 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-violet-900/30 flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Forging…
                </>
              ) : (
                <>✨ Generate {mode === 'slides' ? 'deck' : 'page'}</>
              )}
            </button>

            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 text-sm text-red-300 p-3">
                {error}
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-2">
                Examples
              </label>
              <div className="space-y-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => { setMode(ex.mode); setPrompt(ex.prompt); }}
                    className="w-full text-left px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-elevated)] hover:border-[var(--accent)] transition text-sm group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[var(--text-primary)]">{ex.label}</span>
                      <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] group-hover:text-[var(--accent)]">
                        {ex.mode}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] line-clamp-2 mt-0.5">
                      {ex.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {result && (
              <div className="rounded-md border border-[var(--border)] bg-[var(--bg-primary)] p-3 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Generation
                </div>
                <div className="text-sm font-medium truncate" title={result.title}>
                  {result.title}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  via {result.provider} · {result.model}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Workspace */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
          {/* Tabs */}
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 sm:px-5 h-11 bg-[var(--bg-surface)]/40 shrink-0">
            <div className="inline-flex p-1 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)]">
              <button
                onClick={() => setView('preview')}
                disabled={!result}
                className={`px-3 h-7 rounded text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  view === 'preview' && result
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setView('code')}
                disabled={!result}
                className={`px-3 h-7 rounded text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  view === 'code' && result
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Code
              </button>
            </div>

            {/* Mobile export buttons (hidden when no result) */}
            {result && (
              <div className="flex sm:hidden items-center gap-1.5">
                <button
                  onClick={downloadHtml}
                  className="h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-surface)] text-[11px] hover:bg-[var(--bg-elevated)]"
                >
                  HTML
                </button>
                <button
                  onClick={downloadProject}
                  disabled={exporting === 'project'}
                  className="h-7 px-2 rounded bg-emerald-500 text-white text-[11px] font-medium disabled:opacity-50"
                >
                  {exporting === 'project' ? '…' : 'Project'}
                </button>
              </div>
            )}

            {result && view === 'code' && (
              <button
                onClick={copyJsx}
                className="hidden sm:flex h-7 px-2.5 rounded border border-[var(--border)] bg-[var(--bg-surface)] text-[11px] hover:bg-[var(--bg-elevated)] items-center gap-1"
              >
                {copied ? '✓ Copied' : 'Copy JSX'}
              </button>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 relative bg-[var(--bg-elevated)]">
            {!result && !busy && (
              <EmptyState />
            )}
            {busy && <LoadingForge mode={mode} />}
            {result && view === 'preview' && previewSrcDoc && (
              <iframe
                ref={iframeRef}
                title="Preview"
                srcDoc={previewSrcDoc}
                sandbox="allow-scripts"
                className="absolute inset-0 w-full h-full bg-white"
              />
            )}
            {result && view === 'code' && (
              <div className="absolute inset-0 overflow-auto scroll-thin bg-[var(--bg-primary)]">
                <pre className="p-4 sm:p-6 text-[12px] leading-relaxed font-mono text-[var(--text-primary)] whitespace-pre">
{result.jsx}
                </pre>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Loading animation ───────────────────────────────────────────────────────
// A wireframe of the UI being assembled, with stroke-draw animations on each
// block + rotating status messages. Far less boring than a spinner during a
// 10–30s wait.

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
    <div className="absolute inset-0 grid place-items-center bg-[var(--bg-elevated)] overflow-hidden">
      {/* soft animated glow */}
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full bg-violet-600/30 blur-3xl animate-forge-pulse" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 px-6">
        {mode === 'slides' ? <SlidesWireframe /> : <PageWireframe />}

        <div className="space-y-2 text-center">
          <div
            key={statusIdx}
            className="text-sm text-[var(--text-primary)] font-medium animate-forge-fade-in"
          >
            {statuses[statusIdx]}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] flex items-center justify-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-forge-dot" />
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-forge-dot [animation-delay:0.18s]" />
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-forge-dot [animation-delay:0.36s]" />
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
  // Wireframe of a generic page: header bar + hero + 3 cards row + content row.
  const stroke = 'rgba(167, 139, 250, 0.85)';
  const fill = 'rgba(167, 139, 250, 0.15)';
  return (
    <svg width="320" height="200" viewBox="0 0 320 200" fill="none">
      {/* Header bar */}
      <rect x="10" y="10" width="300" height="22" rx="4"
        stroke={stroke} strokeWidth="1.5" className="forge-draw" style={{ ['--len' as string]: '650' } as React.CSSProperties} />
      <circle cx="22" cy="21" r="4" fill={stroke} />
      <rect x="32" y="18" width="42" height="6" rx="2" fill={fill} />
      <rect x="240" y="17" width="60" height="8" rx="2" fill={fill} />

      {/* Hero block */}
      <rect x="10" y="42" width="300" height="58" rx="4"
        stroke={stroke} strokeWidth="1.5" className="forge-draw" style={{ ['--len' as string]: '720', animationDelay: '0.15s' } as React.CSSProperties} />
      <rect x="22" y="56" width="180" height="8" rx="2" fill={stroke} className="forge-fill" style={{ animationDelay: '0.2s' } as React.CSSProperties} />
      <rect x="22" y="70" width="240" height="5" rx="2" fill={fill} className="forge-fill" style={{ animationDelay: '0.35s' } as React.CSSProperties} />
      <rect x="22" y="80" width="200" height="5" rx="2" fill={fill} className="forge-fill" style={{ animationDelay: '0.45s' } as React.CSSProperties} />

      {/* Cards row */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={10 + i * 102} y={110} width="96" height="50" rx="4"
            stroke={stroke} strokeWidth="1.5" className="forge-draw"
            style={{ ['--len' as string]: '290', animationDelay: `${0.4 + i * 0.12}s` } as React.CSSProperties}
          />
          <circle cx={20 + i * 102} cy={122} r="4" fill={fill} />
          <rect x={28 + i * 102} y={119} width="48" height="6" rx="2" fill={fill} />
          <rect x={20 + i * 102} y={138} width="76" height="4" rx="2" fill={fill} />
          <rect x={20 + i * 102} y={146} width="60" height="4" rx="2" fill={fill} />
        </g>
      ))}

      {/* Bottom content */}
      <rect x="10" y="170" width="300" height="20" rx="4"
        stroke={stroke} strokeWidth="1.5" className="forge-draw" style={{ ['--len' as string]: '650', animationDelay: '0.8s' } as React.CSSProperties} />
    </svg>
  );
}

function SlidesWireframe() {
  // Wireframe of a slide deck: 4 slide thumbnails with progress dots.
  const stroke = 'rgba(167, 139, 250, 0.85)';
  const fill = 'rgba(167, 139, 250, 0.15)';
  const slides = [
    { titleW: 110, hasMark: true, kind: 'title' },
    { titleW: 60, hasMark: false, kind: 'agenda' },
    { titleW: 80, hasMark: false, kind: 'data' },
    { titleW: 90, hasMark: false, kind: 'closing' },
  ];
  return (
    <svg width="320" height="200" viewBox="0 0 320 200" fill="none">
      {slides.map((s, i) => {
        const x = 10 + i * 78;
        return (
          <g key={i}>
            <rect
              x={x} y={20} width="68" height="100" rx="4"
              stroke={stroke} strokeWidth="1.5" className="forge-draw"
              style={{ ['--len' as string]: '345', animationDelay: `${i * 0.18}s` } as React.CSSProperties}
            />
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

      {/* Progress dots */}
      <g transform="translate(146, 152)">
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} cx={i * 10} cy={0} r="3" fill={fill}
            className="forge-fill" style={{ animationDelay: `${0.5 + i * 0.18}s`, transformOrigin: `${i * 10}px 0` } as React.CSSProperties} />
        ))}
      </g>
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="absolute inset-0 grid place-items-center px-6">
      <div className="max-w-md text-center space-y-3">
        <div className="text-4xl">🎨</div>
        <h2 className="text-lg font-semibold">Generate a UI or slide deck</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Pick <strong>Page</strong> for a single focused screen, or <strong>Slides</strong> for a 5–7 slide deck.
          Describe what you want, then hit Generate. The result is real React + Tailwind that you can preview, copy, or
          export as a runnable Vite project.
        </p>
      </div>
    </div>
  );
}

function slug(s: string): string {
  return (s || 'forge-ui')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'forge-ui';
}
