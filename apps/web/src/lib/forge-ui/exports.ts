'use client';

// Capture utilities for poster export.
//
// The preview iframe uses sandbox="allow-scripts" (no same-origin) for safety,
// which means we can't read its DOM from the parent for capture. For exports
// we spin up a temporary OFFSCREEN iframe with `allow-scripts allow-same-origin`,
// render the same HTML at the target export size, capture frames via
// html-to-image, then dispose of it. The capture iframe is never visible.
//
// Aspect ratios map to standard social-media dimensions so the PNG/GIF/video
// output is post-ready without further resizing.

import { toBlob, toCanvas } from 'html-to-image';
import GIF from 'gif.js';

export type AspectRatio = '1:1' | '9:16' | '4:5' | '16:9';

const DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
};

export function aspectDimensions(ratio: AspectRatio) {
  return DIMENSIONS[ratio];
}

/**
 * Build an offscreen iframe with the same HTML as the preview, sized to the
 * target export dimensions. Resolves with the iframe element once its inner
 * document signals it has rendered.
 *
 * The iframe is appended to document.body but positioned far off-screen with
 * pointer-events: none so it doesn't interfere with the visible UI.
 *
 * Caller is responsible for calling iframe.remove() after capture.
 */
async function mountCaptureIframe(
  html: string,
  ratio: AspectRatio,
): Promise<HTMLIFrameElement> {
  const { width, height } = DIMENSIONS[ratio];
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  iframe.setAttribute('title', 'forge-export');
  iframe.style.cssText = [
    'position:fixed',
    'left:-99999px',
    'top:0',
    `width:${width}px`,
    `height:${height}px`,
    'border:0',
    'pointer-events:none',
    'opacity:0',
  ].join(';');
  iframe.srcdoc = html;
  document.body.appendChild(iframe);

  // Wait for the React component inside to render. The wrap sets
  // document.body.dataset.forgeRendered = '1' on successful render — poll for
  // it with a hard timeout so a broken doc can't hang the export.
  const deadline = Date.now() + 8000;
  await new Promise<void>((resolve) => {
    const start = () => {
      const tick = () => {
        try {
          const doc = iframe.contentDocument;
          if (doc?.body?.dataset.forgeRendered === '1') return resolve();
          if (Date.now() > deadline) return resolve();
        } catch {
          if (Date.now() > deadline) return resolve();
        }
        requestAnimationFrame(tick);
      };
      tick();
    };
    if (iframe.contentDocument?.readyState === 'complete') start();
    else iframe.addEventListener('load', start, { once: true });
  });

  // One extra rAF tick to let entrance animations begin their first frame —
  // without this, captured frame 0 shows pre-mount state for posters that
  // use the `mounted` flag pattern.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return iframe;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function captureNode(iframe: HTMLIFrameElement): HTMLElement {
  const doc = iframe.contentDocument;
  if (!doc) throw new Error('Capture iframe has no document — same-origin access denied.');
  // documentElement is more reliable than body for layouts that paint the
  // background on <html> (some Tailwind-generated styles do).
  return doc.documentElement;
}

// ─── PNG ────────────────────────────────────────────────────────────────────

export async function exportPosterPng(opts: {
  html: string;
  ratio: AspectRatio;
  filename: string;
}): Promise<void> {
  const { width, height } = DIMENSIONS[opts.ratio];
  const iframe = await mountCaptureIframe(opts.html, opts.ratio);
  try {
    const blob = await toBlob(captureNode(iframe), {
      width,
      height,
      pixelRatio: 1,
      cacheBust: true,
    });
    if (!blob) throw new Error('PNG encoding produced no output.');
    downloadBlob(blob, opts.filename.endsWith('.png') ? opts.filename : `${opts.filename}.png`);
  } finally {
    iframe.remove();
  }
}

// ─── GIF ────────────────────────────────────────────────────────────────────

export type GifOpts = {
  html: string;
  ratio: AspectRatio;
  filename: string;
  durationMs?: number;
  fps?: number;
  onProgress?: (pct: number, stage: 'capturing' | 'encoding') => void;
};

export async function exportPosterGif(opts: GifOpts): Promise<void> {
  const { width, height } = DIMENSIONS[opts.ratio];
  // Defaults tuned for social posts: 3s is the most common ad loop length.
  const durationMs = opts.durationMs ?? 3000;
  const fps = opts.fps ?? 12;
  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  const frameDelay = Math.round(1000 / fps);

  const iframe = await mountCaptureIframe(opts.html, opts.ratio);
  // GIFs at full social resolution are huge. Down-scale to a more reasonable
  // export size while keeping the same aspect ratio — 720 on the long side
  // is plenty for Instagram/Twitter and keeps the file under ~5MB.
  const longest = Math.max(width, height);
  const scale = longest > 720 ? 720 / longest : 1;
  const outW = Math.round(width * scale);
  const outH = Math.round(height * scale);

  try {
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: outW,
      height: outH,
      workerScript: '/gif.worker.js',
    });

    for (let i = 0; i < totalFrames; i++) {
      const canvas = await toCanvas(captureNode(iframe), {
        width,
        height,
        pixelRatio: 1,
        cacheBust: false,
      });
      // Resize each captured frame onto a scratch canvas at output size so we
      // don't bloat the GIF with full-res frames.
      const scratch = document.createElement('canvas');
      scratch.width = outW;
      scratch.height = outH;
      const ctx = scratch.getContext('2d');
      if (!ctx) throw new Error('Could not get 2D context for GIF frame.');
      ctx.drawImage(canvas, 0, 0, outW, outH);
      gif.addFrame(scratch, { copy: true, delay: frameDelay });
      opts.onProgress?.((i + 1) / totalFrames, 'capturing');
      // Pace frame captures to the target framerate, otherwise we capture as
      // fast as html-to-image can run (often ~5fps) and the resulting GIF
      // plays back the source animation in fast-forward.
      await new Promise((r) => setTimeout(r, frameDelay));
    }

    const blob: Blob = await new Promise((resolve, reject) => {
      gif.on('progress', (p: number) => opts.onProgress?.(p, 'encoding'));
      gif.on('finished', (b: Blob) => resolve(b));
      // gif.js doesn't surface a proper error event — wrap in a timeout safety
      // net so a stuck encode doesn't leave the UI in busy state forever.
      const fail = setTimeout(() => reject(new Error('GIF encoding timed out.')), 90_000);
      gif.on('finished', () => clearTimeout(fail));
      gif.render();
    });

    downloadBlob(blob, opts.filename.endsWith('.gif') ? opts.filename : `${opts.filename}.gif`);
  } finally {
    iframe.remove();
  }
}

// ─── WebM video ─────────────────────────────────────────────────────────────

export type VideoOpts = {
  html: string;
  ratio: AspectRatio;
  filename: string;
  durationMs?: number;
  fps?: number;
  onProgress?: (pct: number) => void;
};

export async function exportPosterVideo(opts: VideoOpts): Promise<void> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Video export is not supported in this browser.');
  }
  const { width, height } = DIMENSIONS[opts.ratio];
  const durationMs = opts.durationMs ?? 4000;
  const fps = opts.fps ?? 15;
  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  const frameDelay = 1000 / fps;

  const iframe = await mountCaptureIframe(opts.html, opts.ratio);

  // Backing canvas streamed to MediaRecorder. We draw each captured frame
  // onto this canvas at the target framerate so the resulting WebM plays
  // back at real-time speed.
  const stage = document.createElement('canvas');
  stage.width = width;
  stage.height = height;
  const ctx = stage.getContext('2d');
  if (!ctx) {
    iframe.remove();
    throw new Error('Could not get 2D context for video frame.');
  }

  const stream = stage.captureStream(fps);
  // Pick the best available codec; Safari prefers mp4, Chrome/Firefox prefer webm.
  const mime = pickVideoMime();
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: BlobPart[] = [];
  recorder.addEventListener('dataavailable', (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  });

  const recorded = new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener('stop', () => {
      resolve(new Blob(chunks, { type: mime }));
    });
    recorder.addEventListener('error', () => reject(new Error('Recording failed.')));
  });

  try {
    recorder.start();
    for (let i = 0; i < totalFrames; i++) {
      const frame = await toCanvas(captureNode(iframe), {
        width,
        height,
        pixelRatio: 1,
        cacheBust: false,
      });
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(frame, 0, 0, width, height);
      opts.onProgress?.((i + 1) / totalFrames);
      // Pace at the target framerate. We don't worry about catching up on
      // slow frames — MediaRecorder records whatever appears on the canvas
      // stream when it samples, which is fine for a generated poster loop.
      await new Promise((r) => setTimeout(r, frameDelay));
    }
    recorder.stop();
    const blob = await recorded;
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    const base = opts.filename.replace(/\.(webm|mp4)$/i, '');
    downloadBlob(blob, `${base}.${ext}`);
  } finally {
    iframe.remove();
    stream.getTracks().forEach((t) => t.stop());
  }
}

function pickVideoMime(): string {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=h264',
    'video/mp4',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'video/webm';
}
