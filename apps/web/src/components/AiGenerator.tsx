'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { STYLES } from '@iconforge/shared';
import type { IconDTO } from '@iconforge/shared';
import { apiFetch } from '@/lib/api-client';

type Props = {
  open: boolean;
  onClose: () => void;
  onGenerated: (icon: IconDTO) => void;
};

export function AiGenerator({ open, onClose, onGenerated }: Props) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('flat-modern');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<IconDTO[]>([]);

  const handleSubmit = async () => {
    const p = prompt.trim();
    if (!p || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/api/icons/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p, style }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Generation failed');
      }
      const icon: IconDTO = data.icon;
      setRecent((r) => [icon, ...r].slice(0, 6));
      onGenerated(icon);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className="absolute right-0 top-0 h-full w-full sm:max-w-md bg-[var(--bg-surface)] border-l border-[var(--border)] shadow-2xl shadow-black/50 flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 240 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Generate with AI</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Transparent SVG · 120×120 viewBox
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 grid place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                aria-label="Close"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto scroll-thin p-5 space-y-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-2">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value.slice(0, 200))}
                  placeholder="Describe your icon — e.g. a rocket ship, headphones, coffee cup"
                  className="w-full h-28 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] resize-none"
                />
                <div className="text-right text-[10px] text-[var(--text-muted)] mt-1">
                  {prompt.length}/200
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-2">
                  Style
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {STYLES.map((s) => (
                    <button
                      key={s.slug}
                      onClick={() => setStyle(s.slug)}
                      className={clsx(
                        'h-9 px-3 rounded-md text-xs font-medium border transition',
                        style === s.slug
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]',
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300 p-3">
                  {error}
                </div>
              )}

              {recent.length > 0 && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-2">
                    Recently generated
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {recent.map((icon) => (
                      <button
                        key={icon.id}
                        onClick={() => onGenerated(icon)}
                        className="aspect-square rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)] grid place-items-center p-3"
                        title={icon.name}
                      >
                        <div
                          // eslint-disable-next-line react/no-danger
                          dangerouslySetInnerHTML={{
                            __html: icon.svgContent.replace(
                              /<svg([^>]*)>/i,
                              '<svg$1 width="48" height="48" style="max-width:100%;height:auto;">',
                            ),
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <footer className="p-5 border-t border-[var(--border)]">
              <button
                onClick={handleSubmit}
                disabled={loading || !prompt.trim()}
                className="w-full h-11 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-white font-medium hover:from-violet-400 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-violet-900/30 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Forging your icon…
                  </>
                ) : (
                  <>✨ Forge Icon</>
                )}
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
