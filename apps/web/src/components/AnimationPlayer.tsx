'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { IconDTO } from '@iconforge/shared';
import { assetUrl } from '@/lib/api-client';

type AnimData = {
  lottie: object;
  durationMs: number;
  colors: string[];
};

type Props = {
  icon: IconDTO;
};

const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3] as const;

type LottieInstance = {
  play: () => void;
  pause: () => void;
  stop: () => void;
  setSpeed: (speed: number) => void;
  goToAndStop: (frame: number, isFrame: boolean) => void;
  destroy: () => void;
  getDuration: (inFrames: boolean) => number;
  addEventListener: (event: string, cb: () => void) => void;
  removeEventListener: (event: string, cb: () => void) => void;
  currentFrame: number;
  isLoaded: boolean;
};

function tintLottie(lottie: object, hexColor: string): object {
  // Walk the Lottie JSON and replace all stroke/fill colors with the new color
  const r = parseInt(hexColor.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor.slice(5, 7), 16) / 255;

  function walk(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      // Replace color keyframes: {a:0,k:[r,g,b,1]} or animated
      if (
        (obj.ty === 'st' || obj.ty === 'fl') &&
        obj.c &&
        typeof obj.c === 'object'
      ) {
        const c = obj.c as Record<string, unknown>;
        if (c.a === 0 && Array.isArray(c.k) && c.k.length === 4) {
          return { ...obj, c: { a: 0, k: [r, g, b, c.k[3]] } };
        }
      }
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, walk(v)])
      );
    }
    return node;
  }
  return walk(lottie) as object;
}

export function AnimationPlayer({ icon }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<LottieInstance | null>(null);
  const rafRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [loop, setLoop] = useState(true);
  const [progress, setProgress] = useState(0);
  const [color, setColor] = useState<string>('');
  const [totalFrames, setTotalFrames] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lottieLoaded, setLottieLoaded] = useState(false);

  const animData = (() => {
    try {
      if (!icon.animationData) return null;
      return JSON.parse(icon.animationData) as AnimData;
    } catch { return null; }
  })();

  const defaultColor = animData?.colors?.[0] ?? '#6d28d9';

  // Load & mount lottie-web
  const mountLottie = useCallback(async (overrideColor?: string) => {
    if (!containerRef.current || !animData) return;

    // Destroy previous instance
    if (animRef.current) {
      animRef.current.destroy();
      animRef.current = null;
    }

    const lottie = (await import('lottie-web')).default;

    let lottieData = animData.lottie;
    const useColor = overrideColor ?? color ?? defaultColor;
    if (useColor) {
      lottieData = tintLottie(lottieData, useColor);
    }

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop,
      autoplay: playing,
      animationData: lottieData,
    }) as unknown as LottieInstance;

    animRef.current = anim;

    const onLoad = () => {
      setTotalFrames(anim.getDuration(true));
      setLottieLoaded(true);
    };
    anim.addEventListener('DOMLoaded', onLoad);
    anim.setSpeed(speed);
    if (!playing) anim.pause();

    return () => {
      anim.removeEventListener('DOMLoaded', onLoad);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animData, loop]);

  useEffect(() => {
    setColor(defaultColor);
    setPlaying(true);
    setSpeed(1);
    setLoop(true);
    setProgress(0);
    setLottieLoaded(false);
  }, [icon.id, defaultColor]);

  useEffect(() => {
    const cleanup = mountLottie(color || defaultColor);
    return () => { cleanup?.then(fn => fn?.()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icon.id, loop]);

  // Progress tracker
  useEffect(() => {
    if (!animRef.current || isDragging) return;
    const tick = () => {
      if (animRef.current && totalFrames > 0) {
        setProgress(animRef.current.currentFrame / totalFrames);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [totalFrames, isDragging]);

  const togglePlay = () => {
    if (!animRef.current) return;
    if (playing) { animRef.current.pause(); setPlaying(false); }
    else { animRef.current.play(); setPlaying(true); }
  };

  const handleSpeedChange = (s: (typeof SPEEDS)[number]) => {
    setSpeed(s);
    animRef.current?.setSpeed(s);
  };

  const handleColorChange = (hex: string) => {
    setColor(hex);
    mountLottie(hex);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseFloat(e.target.value);
    setProgress(pct);
    if (animRef.current && totalFrames > 0) {
      animRef.current.goToAndStop(pct * totalFrames, true);
    }
  };

  const handleLoopToggle = () => setLoop(l => !l);

  const handleDownloadLottie = () => {
    const url = assetUrl(`/api/icons/${icon.slug}/lottie`);
    const a = document.createElement('a'); a.href = url; a.download = `${icon.slug}.json`; a.click();
  };

  const handleDownloadGif = () => {
    const url = assetUrl(`/api/icons/${icon.slug}/gif`);
    const a = document.createElement('a'); a.href = url; a.download = `${icon.slug}.gif`; a.click();
  };

  const handleDownloadSvg = () => {
    const blob = new Blob([icon.svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${icon.slug}.svg`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!animData) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 text-center text-[var(--text-muted)] text-sm">
        No animation data available for this icon.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] overflow-hidden">

      {/* Preview canvas */}
      <div className="relative bg-[var(--bg-surface)] aspect-square max-h-64 flex items-center justify-center" style={{background:'repeating-conic-gradient(#3f3f46 0% 25%,#27272a 0% 50%) 0 0 / 16px 16px'}}>
        <div
          ref={containerRef}
          className="w-48 h-48"
          style={{ willChange: 'transform' }}
        />
        {!lottieLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-10 h-10"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{
                __html: icon.svgContent.replace(/<svg([^>]*)>/i, '<svg$1 width="40" height="40">'),
              }}
            />
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">

        {/* Scrubber + play */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0 hover:opacity-80 transition text-sm"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            className="forge-slider flex-1"
            onChange={handleScrub}
            onMouseDown={() => { setIsDragging(true); animRef.current?.pause(); }}
            onMouseUp={() => { setIsDragging(false); if (playing) animRef.current?.play(); }}
            onTouchStart={() => { setIsDragging(true); animRef.current?.pause(); }}
            onTouchEnd={() => { setIsDragging(false); if (playing) animRef.current?.play(); }}
            aria-label="Scrubber"
          />
          <button
            onClick={() => { animRef.current?.stop(); animRef.current?.play(); setProgress(0); setPlaying(true); }}
            className="w-8 h-8 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] flex items-center justify-center transition text-sm"
            aria-label="Replay"
            title="Replay"
          >
            ↺
          </button>
        </div>

        {/* Speed */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-2">Speed</div>
          <div className="flex gap-1 flex-wrap">
            {SPEEDS.map(s => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={clsx(
                  'h-7 px-2.5 rounded-md text-xs font-medium border transition',
                  speed === s
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]',
                )}
              >
                {s}×
              </button>
            ))}
            <button
              onClick={handleLoopToggle}
              className={clsx(
                'h-7 px-2.5 rounded-md text-xs font-medium border transition ml-auto',
                loop
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]',
              )}
            >
              {loop ? '⟳ Loop' : '→ Once'}
            </button>
          </div>
        </div>

        {/* Color */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-2">Color</div>
          <div className="flex items-center gap-2 flex-wrap">
            {['#6d28d9','#0ea5e9','#10b981','#ef4444','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#a855f7'].map(hex => (
              <button
                key={hex}
                title={hex}
                onClick={() => handleColorChange(hex)}
                className={clsx(
                  'w-7 h-7 rounded-full border-2 transition',
                  color === hex ? 'border-white scale-110' : 'border-transparent hover:scale-105',
                )}
                style={{ background: hex }}
              />
            ))}
            <label className="relative w-7 h-7 rounded-full border-2 border-[var(--border)] cursor-pointer overflow-hidden hover:scale-105 transition" title="Custom color">
              <span className="absolute inset-0 grid place-items-center text-[11px]">🎨</span>
              <input type="color" value={color || defaultColor} onChange={e => handleColorChange(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
            </label>
            <button
              onClick={() => handleColorChange(defaultColor)}
              className="h-7 px-2 rounded-md text-[10px] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition ml-auto"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Downloads */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-2">Export</div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleDownloadSvg}
              className="h-10 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)] text-xs font-medium transition"
            >
              ↓ SVG
            </button>
            <button
              onClick={handleDownloadLottie}
              className="h-10 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 text-emerald-300 text-xs font-medium transition"
            >
              ↓ Lottie JSON
            </button>
            <button
              onClick={handleDownloadGif}
              className="h-10 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 text-emerald-300 text-xs font-medium transition"
            >
              ↓ GIF 128px
            </button>
          </div>
        </div>

        {/* Info */}
        <p className="text-[11px] text-[var(--text-muted)] border-t border-[var(--border)] pt-3">
          Duration: {animData.durationMs}ms · Lottie v5 · Works in React, Vue, iOS, Android, and web via <code>lottie-web</code>.
        </p>
      </div>
    </div>
  );
}
