/**
 * Programmatic style transformers for Icon Forge platform defaults.
 *
 * Each transformer takes Lucide-style inner SVG markup (paths/rects/etc. drawn
 * for `viewBox="0 0 24 24"`) plus a per-icon seed (the slug — used to derive
 * unique SVG filter/gradient IDs and pick palette colors deterministically),
 * and returns a complete <svg>…</svg> string in that style.
 *
 * These are heuristic transforms for offline defaults, not pixel-perfect
 * stylings. AI generation produces higher-fidelity icons per user.
 */

const VB = 'viewBox="0 0 24 24"';
const NS = 'xmlns="http://www.w3.org/2000/svg"';

function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

function pick<T>(seed: string, arr: T[]): T {
  return arr[hash(seed) % arr.length];
}

function safeId(seed: string, prefix: string): string {
  return `${prefix}-${seed.replace(/[^a-z0-9]/gi, '')}`;
}

export type StyleId =
  | 'line-art'
  | 'flat-modern'
  | 'anime'
  | '3d-clay'
  | 'neon-glow'
  | 'liquid-glass';

export const STYLE_IDS: StyleId[] = [
  'line-art',
  'flat-modern',
  'anime',
  '3d-clay',
  'neon-glow',
  'liquid-glass',
];

type Builder = (inner: string, seed: string) => string;

// ─── line-art ──────────────────────────────────────────────────────────────
// Monochrome, clean strokes. Uses currentColor so it inherits the UI's text
// color (light on the dark theme).
const lineArt: Builder = (inner) =>
  `<svg ${NS} ${VB} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

// ─── flat-modern ───────────────────────────────────────────────────────────
// Flat geometric. Slightly thicker stroke, vibrant 2-color accent (primary +
// matching tinted fill region for closed shapes).
const FLAT_PALETTE: Array<[string, string]> = [
  ['#1a237e', '#c5cae9'], // navy + light navy
  ['#ff7043', '#ffccbc'], // coral + peach
  ['#26a69a', '#b2dfdb'], // teal + mint
  ['#ffd54f', '#fff9c4'], // yellow + cream
  ['#5e35b1', '#d1c4e9'], // deep purple + lavender
  ['#26c6da', '#b2ebf2'], // cyan + ice
];

const flatModern: Builder = (inner, seed) => {
  const [stroke, fill] = pick(seed, FLAT_PALETTE);
  return `<svg ${NS} ${VB} fill="${fill}" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
};

// ─── anime ─────────────────────────────────────────────────────────────────
// Bold, vibrant outlines + a few decorative sparkles in the corners.
const ANIME_PALETTE = ['#ff6b9d', '#ffa726', '#42a5f5', '#ec407a', '#ab47bc'];

const anime: Builder = (inner, seed) => {
  const stroke = pick(seed, ANIME_PALETTE);
  const accent = pick(seed + 'a', ANIME_PALETTE.filter((c) => c !== stroke));
  const sparkles = `
    <g fill="${accent}" opacity="0.85">
      <path d="M3 4 L3.4 4.8 L4.2 5.2 L3.4 5.6 L3 6.4 L2.6 5.6 L1.8 5.2 L2.6 4.8 Z" />
      <path d="M21 19 L21.3 19.6 L21.9 19.9 L21.3 20.2 L21 20.8 L20.7 20.2 L20.1 19.9 L20.7 19.6 Z" />
    </g>`;
  return `<svg ${NS} ${VB} fill="none" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${inner}${sparkles}</svg>`;
};

// ─── 3d-clay ───────────────────────────────────────────────────────────────
// Soft, puffy colored shapes with a top-left highlight and bottom-right
// shadow simulated via SVG filter (offset + gaussian blur).
const CLAY_PALETTE = [
  '#ffccbc',
  '#d1c4e9',
  '#c8e6c9',
  '#ffe0b2',
  '#bbdefb',
  '#f8bbd0',
];

const clay: Builder = (inner, seed) => {
  const fill = pick(seed, CLAY_PALETTE);
  const stroke = '#ffffff';
  const shadowId = safeId(seed, 'clayshadow');
  const highlightId = safeId(seed, 'clayhi');
  return `<svg ${NS} ${VB}>
    <defs>
      <filter id="${shadowId}" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="0.6" />
        <feOffset dx="0.6" dy="0.8" result="offsetblur" />
        <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id="${highlightId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55" />
        <stop offset="60%" stop-color="${fill}" stop-opacity="1" />
      </linearGradient>
    </defs>
    <g filter="url(#${shadowId})" fill="url(#${highlightId})" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
  </svg>`;
};

// ─── neon-glow ─────────────────────────────────────────────────────────────
// Thin glowing strokes layered on top of a blurred halo, no background.
const NEON_PALETTE = ['#ff0080', '#00ffff', '#bf00ff', '#39ff14', '#ff4fa3'];

const neon: Builder = (inner, seed) => {
  const color = pick(seed, NEON_PALETTE);
  const glowId = safeId(seed, 'neonglow');
  return `<svg ${NS} ${VB}>
    <defs>
      <filter id="${glowId}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#${glowId})" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.9">${inner}</g>
    <g fill="none" stroke="#ffffff" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.95">${inner}</g>
  </svg>`;
};

// ─── liquid-glass ──────────────────────────────────────────────────────────
// Translucent gradient stroke + soft outer glow + subtle drop-shadow.
const GLASS_PALETTE: Array<[string, string]> = [
  ['#a8d8ea', '#b388ff'],
  ['#82b1ff', '#ce93d8'],
  ['#90caf9', '#b39ddb'],
  ['#bbdefb', '#9fa8da'],
];

const glass: Builder = (inner, seed) => {
  const [c1, c2] = pick(seed, GLASS_PALETTE);
  const gradId = safeId(seed, 'glassg');
  const blurId = safeId(seed, 'glassblur');
  return `<svg ${NS} ${VB}>
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
      <filter id="${blurId}" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="0.7" />
      </filter>
    </defs>
    <g filter="url(#${blurId})" fill="none" stroke="url(#${gradId})" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.55">${inner}</g>
    <g fill="url(#${gradId})" fill-opacity="0.18" stroke="url(#${gradId})" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
    <g fill="none" stroke="#ffffff" stroke-width="0.45" stroke-opacity="0.8" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
  </svg>`;
};

export const STYLE_BUILDERS: Record<StyleId, Builder> = {
  'line-art': lineArt,
  'flat-modern': flatModern,
  anime: anime,
  '3d-clay': clay,
  'neon-glow': neon,
  'liquid-glass': glass,
};

export function extractInner(rawLucideSvg: string): string {
  const noComments = rawLucideSvg.replace(/<!--[\s\S]*?-->/g, '');
  const m = noComments.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  return m ? m[1].trim() : rawLucideSvg.trim();
}
