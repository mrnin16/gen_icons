export function stripBackgroundRect(svg: string): string {
  let out = svg;
  out = out.replace(
    /<rect[^>]*width=["']120["'][^>]*height=["']120["'][^>]*\/?>/gi,
    '',
  );
  out = out.replace(
    /<rect[^>]*height=["']120["'][^>]*width=["']120["'][^>]*\/?>/gi,
    '',
  );
  out = out.replace(/<rect[^>]*width=["']100%["'][^>]*height=["']100%["'][^>]*\/?>/gi, '');
  return out;
}

export function setSvgSize(svg: string, size: number): string {
  let out = svg;
  if (/<svg[^>]*\swidth=/.test(out)) {
    out = out.replace(/(<svg[^>]*\swidth=)["'][^"']*["']/, `$1"${size}"`);
  } else {
    out = out.replace(/<svg/, `<svg width="${size}"`);
  }
  if (/<svg[^>]*\sheight=/.test(out)) {
    out = out.replace(/(<svg[^>]*\sheight=)["'][^"']*["']/, `$1"${size}"`);
  } else {
    out = out.replace(/<svg/, `<svg height="${size}"`);
  }
  if (!/<svg[^>]*\sviewBox=/.test(out)) {
    out = out.replace(/<svg/, `<svg viewBox="0 0 120 120"`);
  }
  return out;
}

export function svgToDataUrl(svg: string): string {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    const utf8 = new TextEncoder().encode(svg);
    let binary = '';
    utf8.forEach((b) => (binary += String.fromCharCode(b)));
    return `data:image/svg+xml;base64,${window.btoa(binary)}`;
  }
  const b64 = Buffer.from(svg, 'utf-8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

export async function svgToPngBlob(svg: string, size: number): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('svgToPngBlob requires a browser environment');
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const sized = setSvgSize(svg, size);
  const url = svgToDataUrl(sized);

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load SVG into Image'));
    img.src = url;
  });

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/png',
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, mime = 'text/plain'): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

export function pascalCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

export function kebabCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function snakeCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
