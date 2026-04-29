/**
 * Apply user-controlled color + stroke-width customization to a styled SVG.
 *
 * Rules (preserve consistency across all 6 styles):
 *  - "Primary" colors (any non-preserved color in stroke / fill / stop-color)
 *    are replaced with the user's chosen color.
 *  - White (`#ffffff` / `#fff` / `white`) is treated as a highlight/inner-core
 *    accent and is preserved — this keeps neon-glow's bright core, 3d-clay's
 *    top-light highlight, liquid-glass's gloss line all intact.
 *  - `none` and `currentColor` are preserved.
 *  - Gradient references (`url(#…)`) are preserved.
 *  - All numeric `stroke-width` values are multiplied by the user's scale.
 *
 * When `color` is undefined and `strokeWidthScale === 1`, this is a no-op.
 */

export type CustomizeOptions = {
  color?: string | null;
  strokeWidthScale?: number;
};

/**
 * Treat these as styling accents that must NOT be recolored, regardless of
 * what the user picks: highlights, transparent regions, gradient refs.
 *
 * `currentColor` is intentionally NOT in this list — when the user picks a
 * color we want to replace it (line-art icons would otherwise stay neutral).
 */
function isPreservedColor(raw: string): boolean {
  const c = raw.trim().toLowerCase();
  if (!c) return true;
  if (c === 'none' || c === 'transparent') return true;
  if (c === 'white' || c === '#fff' || c === '#ffffff') return true;
  if (c.startsWith('url(')) return true;
  return false;
}

function replaceAttr(svg: string, attr: string, newValue: string): string {
  const re = new RegExp(`(\\b${attr}=)(["'])([^"']*)\\2`, 'gi');
  return svg.replace(re, (full, prefix, quote, value) =>
    isPreservedColor(value) ? full : `${prefix}${quote}${newValue}${quote}`,
  );
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((n) => clamp255(n).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Mix `hex` with white. amount=0 → unchanged; amount=1 → white.
 * Used to derive a lighter fill so flat-style icons don't end up as solid blobs.
 */
function lighten(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Append a fixed suffix to every `id="…"` and matching `url(#…)` reference.
 *
 * Why: 3d-clay and liquid-glass styles use `<filter>` / `<linearGradient>`
 * with IDs that are unique per icon. But when the modal opens the SAME icon
 * that's also rendered in the grid behind it, both SVGs share IDs → the
 * browser's document-wide ID lookup picks the first match, so the modal's
 * customized defs are ignored and the preview keeps its original colors.
 * Renaming IDs in the customized copy makes it isolated from the grid.
 */
function uniqifyIds(svg: string, suffix: string): string {
  const ids: string[] = [];
  const idRe = /\bid=("|')([^"']+)\1/g;
  let m: RegExpExecArray | null;
  while ((m = idRe.exec(svg)) !== null) {
    if (!ids.includes(m[2])) ids.push(m[2]);
  }
  if (ids.length === 0) return svg;

  let out = svg;
  for (const id of ids) {
    const next = id + suffix;
    out = out.replace(
      new RegExp(`(\\bid=)(["'])${escapeRegex(id)}\\2`, 'g'),
      `$1$2${next}$2`,
    );
    out = out.replace(
      new RegExp(`url\\(#${escapeRegex(id)}\\)`, 'g'),
      `url(#${next})`,
    );
  }
  return out;
}

export function customizeSvg(svg: string, opts: CustomizeOptions): string {
  let out = svg;

  const color = opts.color?.trim();
  const scale = opts.strokeWidthScale ?? 1;

  if (color) {
    const fillTint = lighten(color, 0.65);
    out = replaceAttr(out, 'stroke', color);
    out = replaceAttr(out, 'fill', fillTint);
    out = replaceAttr(out, 'stop-color', color);
  }

  if (scale !== 1) {
    out = out.replace(
      /(\bstroke-width=)(["'])([\d.]+)\2/gi,
      (_full, prefix, quote, w) => {
        const next = parseFloat(w) * scale;
        const rounded = Number.isFinite(next)
          ? Math.max(0.1, Math.round(next * 100) / 100)
          : parseFloat(w);
        return `${prefix}${quote}${rounded}${quote}`;
      },
    );
  }

  // Always uniqify defs IDs so the customized SVG can't collide with the
  // matching grid card's filter/gradient defs in the same document.
  out = uniqifyIds(out, '-fc');

  return out;
}

export const DEFAULT_STROKE_SCALE = 1;
export const STROKE_SCALE_MIN = 0.5;
export const STROKE_SCALE_MAX = 3;

export const COLOR_PRESETS: { label: string; value: string | null }[] = [
  { label: 'Default', value: null },
  { label: 'Violet', value: '#a78bfa' },
  { label: 'Sky', value: '#38bdf8' },
  { label: 'Emerald', value: '#34d399' },
  { label: 'Amber', value: '#fbbf24' },
  { label: 'Rose', value: '#fb7185' },
  { label: 'Slate', value: '#64748b' },
  { label: 'White', value: '#fafafa' },
];
