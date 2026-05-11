'use client';

// Background-removal heuristic for clean product photos. No ML, no network,
// no deps — just a bilinear gradient model + flood-fill from the borders.
//
// The first version assumed a UNIFORM border color, which broke on the very
// common "studio gradient" photo (top is bright gray, bottom is darker gray).
// This version models the background as a smooth bilinear gradient defined by
// the four image corners, so a pixel matches if it's close to the EXPECTED
// background color at its position — not a single global average.
//
// Falls back to the original image when the bg doesn't look like a smooth,
// desaturated studio backdrop (lifestyle shots, scene photos, busy textures),
// so we never destroy a real photo.

// RGB color distance (Euclidean). Higher = more aggressive removal.
const COLOR_TOLERANCE = 42;

// How much each mid-edge sample is allowed to differ from the bilinear
// prediction. If even ONE mid-edge differs by more than this, we treat the
// border as too inconsistent to be a smooth gradient and skip removal.
const GRADIENT_CONSISTENCY = 36;

// Max corner "chroma" (max−min channel). If any corner is too saturated the
// photo probably has a colored / brand backdrop, not a neutral studio bg —
// skip rather than risk eating product color.
const MAX_CORNER_CHROMA = 70;

// Width (in color distance) of the soft transition band at the cutout edge.
// Pixels within COLOR_TOLERANCE + FEATHER_BAND of bg get a partial alpha.
const FEATHER_BAND = 22;

export type BgRemovalResult = {
  dataUrl: string;
  // false when the algorithm decided the photo isn't a clean studio shot —
  // caller should keep displaying the original.
  removed: boolean;
};

export async function removeBackground(srcDataUrl: string): Promise<BgRemovalResult> {
  const img = await loadImage(srcDataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w === 0 || h === 0) return { dataUrl: srcDataUrl, removed: false };

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

  // ─── Sample corners (defines the gradient) + mid-edges (validates it) ───
  const at = (x: number, y: number): [number, number, number] => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  // Average a 3×3 block instead of a single pixel so noise / dust specks
  // don't poison the corner reading.
  const avgAt = (x: number, y: number): [number, number, number] => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = Math.max(0, Math.min(w1, x + dx));
        const yy = Math.max(0, Math.min(h1, y + dy));
        const [pr, pg, pb] = at(xx, yy);
        r += pr; g += pg; b += pb; n++;
      }
    }
    return [r / n, g / n, b / n];
  };

  const TL = avgAt(0, 0);
  const TR = avgAt(w1, 0);
  const BL = avgAt(0, h1);
  const BR = avgAt(w1, h1);

  // Corner chroma check — flag colorful backgrounds and skip them.
  const chroma = (c: [number, number, number]) => Math.max(...c) - Math.min(...c);
  const maxChroma = Math.max(chroma(TL), chroma(TR), chroma(BL), chroma(BR));
  if (maxChroma > MAX_CORNER_CHROMA) {
    return { dataUrl: srcDataUrl, removed: false };
  }

  // Bilinear prediction of the bg color at (x, y) from the four corners.
  // Handles vertical gradients, horizontal gradients, and any axis-aligned
  // smooth mix — which covers the vast majority of product photos.
  const expectedBgAt = (x: number, y: number): [number, number, number] => {
    const fx = w1 > 0 ? x / w1 : 0;
    const fy = h1 > 0 ? y / h1 : 0;
    const a = 1 - fx;
    const b = 1 - fy;
    const topR = TL[0] * a + TR[0] * fx;
    const topG = TL[1] * a + TR[1] * fx;
    const topB = TL[2] * a + TR[2] * fx;
    const botR = BL[0] * a + BR[0] * fx;
    const botG = BL[1] * a + BR[1] * fx;
    const botB = BL[2] * a + BR[2] * fx;
    return [topR * b + botR * fy, topG * b + botG * fy, topB * b + botB * fy];
  };

  // Validate that the border is actually a smooth gradient: every mid-edge
  // sample must be close to what the bilinear model predicts. If it isn't,
  // the background is busy (texture, second object, etc.) → skip.
  const validateAt = (x: number, y: number): number => {
    const a = at(x, y);
    const e = expectedBgAt(x, y);
    const dr = a[0] - e[0], dg = a[1] - e[1], db = a[2] - e[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };
  const consistency = Math.max(
    validateAt(w >> 1, 0),
    validateAt(w >> 1, h1),
    validateAt(0, h >> 1),
    validateAt(w1, h >> 1),
    validateAt(w >> 2, 0),
    validateAt((3 * w) >> 2, 0),
    validateAt(w >> 2, h1),
    validateAt((3 * w) >> 2, h1),
  );
  if (consistency > GRADIENT_CONSISTENCY) {
    return { dataUrl: srcDataUrl, removed: false };
  }

  // ─── Flood fill the bg from every edge pixel that fits the model ────────
  const total = w * h;
  const mask = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;
  const tolSq = COLOR_TOLERANCE * COLOR_TOLERANCE;

  // Precompute distances for the whole image once. With ~1M pixels this is
  // ~12MB of Float32 — acceptable, and it makes BFS a simple integer check.
  const distSq = new Float32Array(total);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const p = idx * 4;
      const [er, eg, eb] = expectedBgAt(x, y);
      const dr = data[p] - er;
      const dg = data[p + 1] - eg;
      const db = data[p + 2] - eb;
      distSq[idx] = dr * dr + dg * dg + db * db;
    }
  }

  const trySeed = (idx: number) => {
    if (mask[idx]) return;
    if (distSq[idx] <= tolSq) {
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

  // Sanity check: bg-removal should clear a noticeable chunk of the image.
  // If <5% of pixels were classified as bg the algorithm probably misfired
  // (the product fills the frame, or the seeds didn't take). Bail rather
  // than return a near-identical image with a confusing "BG removed" badge.
  let bgCount = 0;
  for (let i = 0; i < total; i++) if (mask[i]) bgCount++;
  if (bgCount < total * 0.05) {
    return { dataUrl: srcDataUrl, removed: false };
  }

  // ─── Apply alpha + feather the cutout edge ──────────────────────────────
  const featherMax = COLOR_TOLERANCE + FEATHER_BAND;
  const featherMaxSq = featherMax * featherMax;
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

    if (distSq[i] < featherMaxSq) {
      const dist = Math.sqrt(distSq[i]);
      const t = Math.max(0, (dist - COLOR_TOLERANCE) / FEATHER_BAND);
      const alpha = Math.round(t * 255);
      if (alpha < data[i * 4 + 3]) data[i * 4 + 3] = alpha;
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
