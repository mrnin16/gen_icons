'use client';

// Background-removal heuristic for clean product photos with a uniform light
// background (the typical "product-on-white" e-commerce shot). No ML, no
// network, no deps — just edge sampling + flood fill + per-pixel feathering.
//
// Falls back to the original image when the background isn't uniform (e.g.
// lifestyle / scene shots), so we never destroy a real photo.

// Euclidean RGB distance threshold for considering a pixel "background".
// Higher = more aggressive removal. ~36 catches near-white / off-white well
// without eating into colored product pixels.
const COLOR_TOLERANCE = 36;

// Max stddev of edge-sampled colors to consider the border "uniform". A
// busy or gradient background blows past this and we skip removal entirely.
const VARIANCE_THRESHOLD = 35;

// Width (in color distance) of the soft transition band at the cutout edge.
// Pixels that are within COLOR_TOLERANCE + FEATHER_BAND of background and
// border a transparent pixel get a partial alpha — anti-aliases the edge.
const FEATHER_BAND = 18;

export type BgRemovalResult = {
  dataUrl: string;
  // false when the algorithm detected the bg isn't uniform — caller should
  // keep using the original image.
  removed: boolean;
};

export async function removeBackground(srcDataUrl: string): Promise<BgRemovalResult> {
  const img = await loadImage(srcDataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w === 0 || h === 0) {
    return { dataUrl: srcDataUrl, removed: false };
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { dataUrl: srcDataUrl, removed: false };
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const w1 = w - 1;
  const h1 = h - 1;

  // ─── Sample edge pixels to estimate the background color ────────────────
  // Corners + mid-edges + a handful of points along each side. Sampling only
  // the border keeps us robust to a busy product in the middle.
  const samples: number[][] = [];
  const push = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  };
  push(0, 0); push(w1, 0); push(0, h1); push(w1, h1);
  push(w >> 1, 0); push(w >> 1, h1); push(0, h >> 1); push(w1, h >> 1);
  for (let i = 1; i <= 4; i++) {
    const x = Math.floor((w * i) / 5);
    const y = Math.floor((h * i) / 5);
    push(x, 0); push(x, h1); push(0, y); push(w1, y);
  }

  let mr = 0, mg = 0, mb = 0;
  for (const [r, g, b] of samples) { mr += r; mg += g; mb += b; }
  mr /= samples.length; mg /= samples.length; mb /= samples.length;

  let varianceSum = 0;
  for (const [r, g, b] of samples) {
    const dr = r - mr, dg = g - mg, db = b - mb;
    varianceSum += Math.sqrt(dr * dr + dg * dg + db * db);
  }
  const variance = varianceSum / samples.length;

  if (variance > VARIANCE_THRESHOLD) {
    // Background isn't uniform — leave the image alone.
    return { dataUrl: srcDataUrl, removed: false };
  }

  // ─── Flood fill the background from the edges ──────────────────────────
  // A BFS over 4-connected neighbors. Using a Uint8Array mask + an Int32Array
  // ring-buffer queue keeps allocations down for full-resolution images.
  const total = w * h;
  const mask = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;

  const tolSq = COLOR_TOLERANCE * COLOR_TOLERANCE;
  const isBg = (idx: number): boolean => {
    const p = idx * 4;
    const dr = data[p] - mr;
    const dg = data[p + 1] - mg;
    const db = data[p + 2] - mb;
    return dr * dr + dg * dg + db * db <= tolSq;
  };

  const trySeed = (idx: number) => {
    if (mask[idx]) return;
    if (isBg(idx)) {
      mask[idx] = 1;
      queue[qTail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    trySeed(x);
    trySeed(h1 * w + x);
  }
  for (let y = 0; y < h; y++) {
    trySeed(y * w);
    trySeed(y * w + w1);
  }

  while (qHead < qTail) {
    const idx = queue[qHead++];
    const x = idx % w;
    const y = (idx / w) | 0;
    if (x > 0) trySeed(idx - 1);
    if (x < w1) trySeed(idx + 1);
    if (y > 0) trySeed(idx - w);
    if (y < h1) trySeed(idx + w);
  }

  // ─── Apply alpha + feather the edge ─────────────────────────────────────
  // For each non-bg pixel that touches a bg pixel, compute partial alpha
  // based on its color distance from bg. Pixels close to bg (typical of
  // anti-aliased original edges) get reduced alpha; pixels far from bg keep
  // full opacity. This eliminates the visible halo around the cutout.
  const featherMax = COLOR_TOLERANCE + FEATHER_BAND;
  for (let i = 0; i < total; i++) {
    if (mask[i]) {
      data[i * 4 + 3] = 0;
      continue;
    }
    const x = i % w;
    const y = (i / w) | 0;
    let edge = false;
    if (x > 0 && mask[i - 1]) edge = true;
    else if (x < w1 && mask[i + 1]) edge = true;
    else if (y > 0 && mask[i - w]) edge = true;
    else if (y < h1 && mask[i + w]) edge = true;
    if (!edge) continue;

    const p = i * 4;
    const dr = data[p] - mr;
    const dg = data[p + 1] - mg;
    const db = data[p + 2] - mb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < featherMax) {
      const t = Math.max(0, (dist - COLOR_TOLERANCE) / FEATHER_BAND);
      const alpha = Math.round(t * 255);
      if (alpha < data[p + 3]) data[p + 3] = alpha;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return { dataUrl: canvas.toDataURL('image/png'), removed: true };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}
