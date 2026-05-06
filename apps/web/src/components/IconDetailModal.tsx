'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import type { IconDTO } from '@iconforge/shared';
import {
  copyText,
  downloadBlob,
  downloadText,
  setSvgSize,
  svgToDataUrl,
  svgToPngBlob,
  kebabCase,
} from '@iconforge/shared';
import { FRAMEWORKS, type FrameworkId } from '@iconforge/shared';
import { CATEGORY_LABEL } from '@iconforge/shared';
import {
  COLOR_PRESETS,
  DEFAULT_STROKE_SCALE,
  STROKE_SCALE_MAX,
  STROKE_SCALE_MIN,
  customizeSvg,
} from '@/lib/customize-svg';
import { assetUrl } from '@/lib/api-client';

const AnimationPlayer = dynamic(
  () => import('@/components/AnimationPlayer').then(m => m.AnimationPlayer),
  { ssr: false },
);

const SIZE_SNAPS = [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024];

type Tab = 'download' | 'code' | 'animate';

type Props = {
  icon: IconDTO | null;
  onClose: () => void;
};

function nearestSnap(v: number): number {
  return SIZE_SNAPS.reduce((best, s) =>
    Math.abs(s - v) < Math.abs(best - v) ? s : best,
  );
}

export function IconDetailModal({ icon, onClose }: Props) {
  const [size, setSize] = useState(256);
  const [tab, setTab] = useState<Tab>('download');
  const [framework, setFramework] = useState<FrameworkId>('react');
  const [copied, setCopied] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [strokeScale, setStrokeScale] = useState<number>(DEFAULT_STROKE_SCALE);

  // Lottie playback (Animate tab) requires real animationData. Pre-built
  // animated icons ship Lottie JSON; AI-generated animated icons rely on
  // CSS @keyframes baked into svgContent and self-animate in the inline
  // preview, so we skip the Lottie tab for those.
  const hasLottie = !!icon?.animationData;

  useEffect(() => {
    if (icon) {
      setSize(256);
      setTab(hasLottie ? 'animate' : 'download');
      setFramework('react');
      setColor(null);
      setStrokeScale(DEFAULT_STROKE_SCALE);
    }
  }, [icon?.id, hasLottie]);

  useEffect(() => {
    if (!icon) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [icon, onClose]);

  const customized = useMemo(() => {
    if (!icon) return '';
    return customizeSvg(icon.svgContent, { color, strokeWidthScale: strokeScale });
  }, [icon, color, strokeScale]);

  const code = useMemo(() => {
    if (!icon) return '';
    const f = FRAMEWORKS.find((x) => x.id === framework);
    if (!f) return '';
    return f.generate({ name: icon.name, svg: customized, size });
  }, [icon, framework, size, customized]);

  if (!icon) return null;

  const isDefault = color === null && strokeScale === DEFAULT_STROKE_SCALE;

  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
  };

  const handleCopySvg = async () => {
    await copyText(setSvgSize(customized, size));
    flash('svg');
  };
  const handleCopyDataUrl = async () => {
    await copyText(svgToDataUrl(setSvgSize(customized, size)));
    flash('data');
  };
  const handleDownloadSvg = () => {
    downloadText(setSvgSize(customized, size), `${kebabCase(icon.name)}-${size}.svg`, 'image/svg+xml');
  };
  const handleDownloadPng = async () => {
    try {
      const blob = await svgToPngBlob(customized, size);
      downloadBlob(blob, `${kebabCase(icon.name)}-${size}.png`);
    } catch (e) {
      console.error(e);
      alert('PNG export failed: ' + (e as Error).message);
    }
  };
  const handleCopyCode = async () => {
    await copyText(code);
    flash('code');
  };
  const handleDownloadCode = () => {
    const f = FRAMEWORKS.find((x) => x.id === framework);
    if (!f) return;
    downloadText(code, f.filename(icon.name), 'text/plain');
  };

  const handleDownloadLottie = () => {
    const url = assetUrl(`/api/icons/${icon.slug}/lottie`);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${icon.slug}.json`;
    a.click();
  };

  const handleDownloadGif = () => {
    const url = assetUrl(`/api/icons/${icon.slug}/gif`);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${icon.slug}.gif`;
    a.click();
  };

  const handleResetCustomize = () => {
    setColor(null);
    setStrokeScale(DEFAULT_STROKE_SCALE);
  };

  const directUrl = assetUrl(`/svg/${icon.slug}`);

  const handleCopyDirectUrl = async () => {
    await copyText(directUrl);
    flash('url');
  };

  const previewSvg = setSvgSize(customized, Math.min(size, 360));

  return (
    <AnimatePresence>
      {icon && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto scroll-thin rounded-t-2xl sm:rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-surface)] z-10">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{icon.name}</h2>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)]">
                    {icon.style}
                  </span>
                  {icon.isAiGenerated && (
                    <span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                      AI generated
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 grid place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
              <div className="bg-checker rounded-xl border border-[var(--border)] aspect-[16/10] grid place-items-center overflow-hidden">
                <div
                  className="grid place-items-center"
                  style={{ width: Math.min(size, 360), height: Math.min(size, 360), transition: 'width 120ms, height 120ms' }}
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                />
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--text-secondary)]">
                <span>
                  Category:{' '}
                  <span className="text-[var(--text-primary)]">
                    {CATEGORY_LABEL[icon.category] ?? icon.category}
                  </span>
                </span>
                <span>
                  Downloads: <span className="text-[var(--text-primary)]">{icon.downloads}</span>
                </span>
                {icon.tags?.length ? (
                  <span className="flex flex-wrap gap-1">
                    {icon.tags.slice(0, 6).map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                        {t}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                  Size
                </h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {SIZE_SNAPS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={clsx(
                        'h-7 px-2.5 rounded-md text-xs border transition',
                        size === s
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    className="forge-slider"
                    min={16}
                    max={1024}
                    step={1}
                    value={size}
                    onChange={(e) => setSize(parseInt(e.target.value, 10))}
                    onPointerUp={(e) => {
                      const v = parseInt((e.target as HTMLInputElement).value, 10);
                      setSize(nearestSnap(v));
                    }}
                  />
                  <span className="font-mono text-sm text-[var(--text-secondary)] tabular-nums w-16 text-right">
                    {size}px
                  </span>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Customize
                  </h3>
                  {!isDefault && (
                    <button
                      onClick={handleResetCustomize}
                      className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline-offset-2 hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]/40 p-3">
                  <div>
                    <div className="text-[11px] text-[var(--text-muted)] mb-1.5">
                      Color
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {COLOR_PRESETS.map((p) => {
                        const active =
                          (p.value === null && color === null) ||
                          (p.value !== null &&
                            color !== null &&
                            color.toLowerCase() === p.value.toLowerCase());
                        return (
                          <button
                            key={p.label}
                            onClick={() => setColor(p.value)}
                            title={p.label}
                            className={clsx(
                              'h-7 w-7 rounded-full border transition grid place-items-center',
                              active
                                ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40'
                                : 'border-[var(--border)] hover:border-[var(--text-secondary)]',
                            )}
                            style={{
                              background:
                                p.value ?? 'repeating-conic-gradient(#3f3f46 0% 25%, #18181b 0% 50%) 50% / 8px 8px',
                            }}
                          >
                            {p.value === null ? (
                              <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                                ⏻
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                      <label className="relative h-7 w-7 rounded-full border border-[var(--border)] hover:border-[var(--text-secondary)] cursor-pointer overflow-hidden grid place-items-center">
                        <span className="text-[14px] leading-none">🎨</span>
                        <input
                          type="color"
                          value={color ?? '#a78bfa'}
                          onChange={(e) => setColor(e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          aria-label="Custom color picker"
                        />
                      </label>
                      <div className="ml-2 text-[11px] font-mono text-[var(--text-secondary)] tabular-nums">
                        {color ?? 'default'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-[var(--text-muted)]">Stroke width</span>
                      <span className="font-mono text-[var(--text-secondary)] tabular-nums">
                        {strokeScale.toFixed(2)}×
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--text-muted)] w-8 text-right">
                        thin
                      </span>
                      <input
                        type="range"
                        className="forge-slider flex-1"
                        min={STROKE_SCALE_MIN}
                        max={STROKE_SCALE_MAX}
                        step={0.05}
                        value={strokeScale}
                        onChange={(e) =>
                          setStrokeScale(parseFloat(e.target.value))
                        }
                        onDoubleClick={() => setStrokeScale(DEFAULT_STROKE_SCALE)}
                      />
                      <span className="text-[10px] text-[var(--text-muted)] w-8">
                        bold
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="inline-flex p-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]">
                  {hasLottie && (
                    <button
                      onClick={() => setTab('animate')}
                      className={clsx(
                        'px-4 h-8 rounded-md text-sm font-medium transition',
                        tab === 'animate'
                          ? 'bg-emerald-500 text-white'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                      )}
                    >
                      ✨ Animate
                    </button>
                  )}
                  <button
                    onClick={() => setTab('download')}
                    className={clsx(
                      'px-4 h-8 rounded-md text-sm font-medium transition',
                      tab === 'download'
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                    )}
                  >
                    ⬇ Download
                  </button>
                  <button
                    onClick={() => setTab('code')}
                    className={clsx(
                      'px-4 h-8 rounded-md text-sm font-medium transition',
                      tab === 'code'
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                    )}
                  >
                    {'</> Code'}
                  </button>
                </div>

                <div className="mt-4">
                  {tab === 'animate' ? (
                    <AnimationPlayer icon={icon} />
                  ) : tab === 'download' ? (
                    <div className="space-y-3">
                      {hasLottie && (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/8 p-3 space-y-2">
                          <div className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
                            ✨ Animated Downloads
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={handleDownloadLottie}
                              className="h-11 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 text-sm font-medium transition text-emerald-300"
                            >
                              ↓ Lottie JSON
                            </button>
                            <button
                              onClick={handleDownloadGif}
                              className="h-11 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 text-sm font-medium transition text-emerald-300"
                            >
                              ↓ Animated GIF
                            </button>
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)]">
                            Lottie JSON works with React, Vue, iOS, Android, and web via lottie-web.
                            GIF is 128×128 with transparent-compatible palette.
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          onClick={handleDownloadSvg}
                          className="h-11 px-3 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)] text-sm font-medium transition"
                        >
                          ↓ SVG
                        </button>
                        <button
                          onClick={handleDownloadPng}
                          className="h-11 px-3 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)] text-sm font-medium transition"
                        >
                          ↓ PNG {size}×{size}
                        </button>
                        <button
                          onClick={handleCopySvg}
                          className="h-11 px-3 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)] text-sm font-medium transition"
                        >
                          {copied === 'svg' ? '✓ Copied' : '⎘ Copy SVG'}
                        </button>
                        <button
                          onClick={handleCopyDataUrl}
                          className="h-11 px-3 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)] text-sm font-medium transition"
                        >
                          {copied === 'data' ? '✓ Copied' : '⎘ Data URL'}
                        </button>
                      </div>

                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]/40 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                            Direct URL — embed without install
                          </div>
                          <button
                            onClick={handleCopyDirectUrl}
                            className="h-7 px-2 rounded text-[10px] font-medium bg-[var(--bg-elevated)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)] transition"
                          >
                            {copied === 'url' ? '✓ Copied' : 'Copy URL'}
                          </button>
                        </div>
                        <pre className="font-mono text-[11px] text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap">
                          {directUrl}
                        </pre>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Use as <code>{'<img src="…" />'}</code> in any framework — no
                          install needed. Customization (color/stroke) does NOT apply
                          to this URL — it serves the original styled SVG.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {FRAMEWORKS.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => setFramework(f.id)}
                            className={clsx(
                              'h-8 px-3 rounded-md text-xs font-medium border transition',
                              framework === f.id
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]',
                            )}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] overflow-hidden">
                        <pre className="text-xs leading-relaxed p-4 max-h-80 overflow-auto scroll-thin font-mono text-[var(--text-secondary)] whitespace-pre">
                          <code>{code}</code>
                        </pre>
                        <div className="flex justify-end gap-2 p-2 border-t border-[var(--border)] bg-[var(--bg-surface)]">
                          <button
                            onClick={handleCopyCode}
                            className="h-8 px-3 rounded-md text-xs font-medium bg-[var(--bg-elevated)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)] transition"
                          >
                            {copied === 'code' ? '✓ Copied' : 'Copy code'}
                          </button>
                          <button
                            onClick={handleDownloadCode}
                            className="h-8 px-3 rounded-md text-xs font-medium bg-[var(--bg-elevated)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)] transition"
                          >
                            ↓ Download file
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <p className="text-xs text-[var(--text-muted)]">
                💡 All exports have transparent backgrounds.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
