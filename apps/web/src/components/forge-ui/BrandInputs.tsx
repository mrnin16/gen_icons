'use client';

import { useRef, useState } from 'react';

import type { AspectRatio } from '@/lib/forge-ui/exports';

export type Brand = {
  color: string;
  logoDataUrl: string;
  productDataUrl: string;
};

export const EMPTY_BRAND: Brand = { color: '', logoDataUrl: '', productDataUrl: '' };

const PRESET_COLORS = [
  '#cc785c', // forge orange (default)
  '#0ea5e9', // sky
  '#22c55e', // emerald
  '#a855f7', // violet
  '#ef4444', // red
  '#f59e0b', // amber
  '#0f172a', // slate-950
  '#ffffff', // white
];

// Limit uploads server-side as well. Client side: resize to keep brand assets
// tractable in the AI prompt context and history records.
const LOGO_MAX_PX = 512;
const PRODUCT_MAX_PX = 1024;
const TARGET_MIME = 'image/jpeg';
const TARGET_QUALITY = 0.85;

export function BrandInputsPanel({
  value,
  onChange,
  disabled,
}: {
  value: Brand;
  onChange: (next: Brand) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-[#1f1c19] p-3 space-y-3 transition ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-stone-500 font-medium">
          Brand
        </div>
        {(value.color || value.logoDataUrl || value.productDataUrl) && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_BRAND)}
            className="text-[10px] text-stone-500 hover:text-stone-300 transition"
          >
            Clear
          </button>
        )}
      </div>

      <ColorRow
        value={value.color}
        onChange={(color) => onChange({ ...value, color })}
      />

      <div className="grid grid-cols-2 gap-2">
        <ImageRow
          label="Logo"
          value={value.logoDataUrl}
          onChange={(logoDataUrl) => onChange({ ...value, logoDataUrl })}
          maxPx={LOGO_MAX_PX}
          hint="Optional · square works best"
        />
        <ImageRow
          label="Product"
          value={value.productDataUrl}
          onChange={(productDataUrl) => onChange({ ...value, productDataUrl })}
          maxPx={PRODUCT_MAX_PX}
          hint="Optional · the visual hero"
        />
      </div>
    </div>
  );
}

function ColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const display = value || '#cc785c';

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] text-stone-400">Brand color</div>
      <div className="flex items-center gap-2">
        <label
          className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/10 cursor-pointer shrink-0 transition hover:border-white/25"
          style={{ background: display }}
          title="Pick a color"
        >
          <input
            type="color"
            value={display}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Brand color"
          />
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value.trim();
            // Auto-prefix # if user types six hex chars
            if (/^[0-9a-fA-F]{6}$/.test(v)) onChange('#' + v);
            else onChange(v);
          }}
          placeholder="#cc785c"
          maxLength={7}
          className="flex-1 min-w-0 h-9 px-2.5 rounded-lg bg-[#2a2622] border border-white/10 text-xs text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-[#cc785c]/50 font-mono uppercase"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="h-9 px-2.5 rounded-lg bg-[#2a2622] border border-white/10 text-[10px] text-stone-400 hover:text-stone-100 hover:border-white/25 transition uppercase tracking-wider"
        >
          Preset
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-8 gap-1 pt-1 animate-forge-fade-in-fast">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={`w-full aspect-square rounded-md border transition ${
                value === c ? 'border-white scale-110' : 'border-white/10 hover:border-white/40'
              }`}
              style={{ background: c }}
              title={c}
              aria-label={`Choose ${c}`}
            />
          ))}
          <style>{`
            @keyframes forge-fade-in-fast { 0% { opacity: 0; transform: translateY(-4px); } 100% { opacity: 1; transform: translateY(0); } }
            .animate-forge-fade-in-fast { animation: forge-fade-in-fast 0.18s ease-out; }
          `}</style>
        </div>
      )}
    </div>
  );
}

function ImageRow({
  label,
  value,
  onChange,
  maxPx,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxPx: number;
  hint: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (file: File | null | undefined) => {
    if (!file) return;
    setErr(null);
    if (!file.type.startsWith('image/')) {
      setErr('Pick an image file.');
      return;
    }
    try {
      const dataUrl = await resizeImageFile(file, maxPx);
      onChange(dataUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not read image.');
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] text-stone-400 flex items-center justify-between">
        <span>{label}</span>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[10px] text-stone-500 hover:text-red-300 transition"
          >
            Remove
          </button>
        )}
      </div>
      <div
        className={`relative h-20 rounded-lg border border-dashed border-white/15 bg-[#2a2622] overflow-hidden transition hover:border-white/30 ${
          value ? 'border-solid border-white/10' : ''
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void onFile(e.dataTransfer.files?.[0]);
        }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URLs don't need Next/Image
          <img
            src={value}
            alt={`${label} preview`}
            className="absolute inset-0 w-full h-full object-contain p-2"
          />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-stone-500 hover:text-stone-300 text-[10px] gap-1 transition"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="m17 8-5-5-5 5" />
              <path d="M12 3v12" />
            </svg>
            <span>Upload {label.toLowerCase()}</span>
            <span className="text-stone-600 text-[9px]">{hint}</span>
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute top-1 right-1 h-5 px-1.5 rounded bg-black/60 text-[9px] text-stone-300 hover:text-stone-100 transition"
          >
            Change
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {err && <div className="text-[10px] text-red-400">{err}</div>}
    </div>
  );
}

// ─── Image resize utility ───────────────────────────────────────────────────

async function resizeImageFile(file: File, maxPx: number): Promise<string> {
  const src = await readFileAsDataUrl(file);
  const img = await loadImage(src);
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest <= maxPx) return src; // Already small enough.

  const scale = maxPx / longest;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context.');
  ctx.drawImage(img, 0, 0, w, h);
  // PNG preserves transparency (important for logos with transparent
  // backgrounds), JPEG compresses better for photos (products). If the source
  // file is PNG and small enough to keep as-is, we'd already have returned.
  const preferPng = file.type === 'image/png' || file.type === 'image/svg+xml';
  return canvas.toDataURL(preferPng ? 'image/png' : TARGET_MIME, TARGET_QUALITY);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Failed to read file.'));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image.'));
    img.src = src;
  });
}

// ─── Aspect ratio chips ─────────────────────────────────────────────────────

const RATIOS: { id: AspectRatio; label: string; sub: string }[] = [
  { id: '1:1', label: '1:1', sub: 'Post' },
  { id: '4:5', label: '4:5', sub: 'Portrait' },
  { id: '9:16', label: '9:16', sub: 'Story' },
  { id: '16:9', label: '16:9', sub: 'Wide' },
];

export function AspectRatioChips({
  value,
  onChange,
  disabled,
}: {
  value: AspectRatio;
  onChange: (v: AspectRatio) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="text-[11px] uppercase tracking-wider text-stone-500 mr-1">Size</div>
      <div className={`flex gap-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {RATIOS.map((r) => {
          const active = value === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange(r.id)}
              className={`group h-7 px-2 rounded-md border text-[10px] font-medium transition flex items-center gap-1 ${
                active
                  ? 'bg-[#cc785c]/20 border-[#cc785c]/50 text-[#e89472]'
                  : 'bg-transparent border-white/10 text-stone-400 hover:text-stone-100 hover:border-white/25'
              }`}
              title={`${r.label} — ${r.sub}`}
              aria-pressed={active}
            >
              <RatioIcon id={r.id} active={active} />
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RatioIcon({ id, active }: { id: AspectRatio; active: boolean }) {
  // Tiny visual hint of the ratio. Roughly proportional rectangle, capped at
  // 12px on the longer axis so all four icons sit in the same line height.
  const stroke = active ? '#e89472' : '#a8a29e';
  const w = id === '16:9' ? 12 : id === '9:16' ? 6 : id === '4:5' ? 8 : 10;
  const h = id === '16:9' ? 7 : id === '9:16' ? 11 : id === '4:5' ? 10 : 10;
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <rect
        x={(12 - w) / 2}
        y={(12 - h) / 2}
        width={w}
        height={h}
        rx="1"
        fill="none"
        stroke={stroke}
        strokeWidth="1.2"
      />
    </svg>
  );
}
