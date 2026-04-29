'use client';

import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { FRAMEWORKS, type FrameworkId } from '@/lib/frameworks';
import { STYLES } from '@/lib/categories';
import { copyText } from '@/lib/svg-utils';

type Props = {
  open: boolean;
  onClose: () => void;
};

const NPM_INSTALLABLE: ReadonlySet<FrameworkId> = new Set([
  'react',
  'nextjs',
  'vue',
  'svelte',
  'angular',
  'react-native',
]);

function npmPackageName(fw: FrameworkId, style: string): string {
  if (fw === 'react-native') return `icon-forge-rn-${style}`;
  if (fw === 'nextjs') return `icon-forge-nextjs-${style}`;
  return `icon-forge-${fw}-${style}`;
}

function importExample(fw: FrameworkId, pkgName: string): string {
  switch (fw) {
    case 'react':
    case 'nextjs':
    case 'react-native':
      return `import { LaptopIcon } from '${pkgName}';

<LaptopIcon size={32} />`;
    case 'vue':
      return `<script setup lang="ts">
import { LaptopIcon } from '${pkgName}';
</script>

<template>
  <LaptopIcon :size="32" />
</template>`;
    case 'svelte':
      return `<script lang="ts">
  import { LaptopIcon } from '${pkgName}';
</script>

<LaptopIcon size={32} />`;
    case 'angular':
      return `import { Component } from '@angular/core';
import { LaptopIconComponent } from '${pkgName}';

@Component({
  standalone: true,
  imports: [LaptopIconComponent],
  template: \`<laptop-icon [size]="32"></laptop-icon>\`,
})
export class AppComponent {}`;
    case 'flutter':
      return `import 'package:icon_forge_<style>/icon_forge_<style>.dart';

LaptopIcon(size: 32)`;
    case 'swiftui':
      return `import IconForge<Style>

LaptopIcon(size: 32)`;
    case 'kotlin':
      return `import com.iconforge.LaptopIcon

LaptopIcon(sizeDp = 32)`;
    case 'html':
      return `<!-- direct SVG -->
<img src="http://localhost:3000/svg/laptop-line-art" width="32" height="32" />

<!-- via sprite + use -->
<svg width="32" height="32"><use href="http://localhost:3000/sprite/line-art#if-laptop" /></svg>`;
  }
}

function CopyableLine({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await copyText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div>
      {label && (
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
          {label}
        </div>
      )}
      <div className="relative rounded-md border border-[var(--border)] bg-[var(--bg-primary)] overflow-hidden">
        <pre
          className={clsx(
            'font-mono text-[11px] text-[var(--text-secondary)] p-3 pr-20 overflow-x-auto whitespace-pre-wrap',
            multiline ? 'leading-relaxed' : '',
          )}
        >
          {value}
        </pre>
        <button
          onClick={handle}
          className="absolute top-2 right-2 h-7 px-2 rounded text-[10px] font-medium bg-[var(--bg-elevated)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)] transition"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

export function BundleExporter({ open, onClose }: Props) {
  const [framework, setFramework] = useState<FrameworkId>('react');
  const [style, setStyle] = useState('line-art');
  const [downloading, setDownloading] = useState<'zip' | 'tgz' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setDownloading(null);
    }
  }, [open]);

  const isNpm = NPM_INSTALLABLE.has(framework);
  const pkgName = npmPackageName(framework, style);
  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const tgzUrl = `${baseUrl}/api/packages/${framework}.tgz?style=${encodeURIComponent(style)}`;
  const zipUrl = `${baseUrl}/api/packages/${framework}?style=${encodeURIComponent(style)}`;
  const spriteUrl = `${baseUrl}/sprite/${encodeURIComponent(style)}`;
  const sampleSvgUrl = `${baseUrl}/svg/laptop-${encodeURIComponent(style)}`;

  const installCmd = useMemo(() => {
    if (isNpm) return `npm install "${tgzUrl}"`;
    switch (framework) {
      case 'flutter':
        return `# 1) Download & extract the zip\n# 2) In your pubspec.yaml:\ndependencies:\n  icon_forge_${style.replace(/-/g, '_')}:\n    path: ./icon_forge_${style.replace(/-/g, '_')}`;
      case 'swiftui':
        return `# 1) Download & extract the zip\n# 2) In Xcode: File → Add Package Dependencies → Add Local…\n#    select the extracted folder.`;
      case 'kotlin':
        return `# 1) Download & extract the zip\n# 2) In your settings.gradle.kts:\nincludeBuild("./icon-forge-kotlin-${style}")`;
      case 'html':
        return `# No install — just use the URLs below.`;
    }
    return `# Download the .zip below and follow the README inside.`;
  }, [framework, style, isNpm, tgzUrl]);

  const handleDownload = async (format: 'zip' | 'tgz') => {
    setError(null);
    setDownloading(format);
    try {
      const url =
        format === 'tgz'
          ? `/api/packages/${framework}.tgz?style=${encodeURIComponent(style)}`
          : `/api/packages/${framework}?style=${encodeURIComponent(style)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') || '';
      const m = cd.match(/filename="([^"]+)"/);
      const fallback = `icon-forge-${framework}-${style}.${format}`;
      const filename = m?.[1] || fallback;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(null);
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
            className="absolute right-0 top-0 h-full w-full max-w-xl bg-[var(--bg-surface)] border-l border-[var(--border)] shadow-2xl shadow-black/50 flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 240 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Get the package</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Install via URL, embed via direct URL, or download a zip.
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

            <div className="flex-1 overflow-y-auto scroll-thin p-5 space-y-6">
              <section>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-2">
                  Framework
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {FRAMEWORKS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFramework(f.id)}
                      className={clsx(
                        'h-10 px-3 rounded-md text-sm font-medium border transition text-left flex items-center justify-between gap-2',
                        framework === f.id
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]',
                      )}
                    >
                      <span>{f.label}</span>
                      {NPM_INSTALLABLE.has(f.id) && (
                        <span
                          className={clsx(
                            'text-[9px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded',
                            framework === f.id
                              ? 'bg-white/20'
                              : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]',
                          )}
                        >
                          npm
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] block mb-2">
                  Style
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {STYLES.map((s) => (
                    <button
                      key={s.slug}
                      onClick={() => setStyle(s.slug)}
                      className={clsx(
                        'h-10 px-3 rounded-md text-sm font-medium border transition',
                        style === s.slug
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]',
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]/40 p-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold tracking-tight">
                    {isNpm ? '1. Install via URL (no zip needed)' : '1. Local install'}
                  </h3>
                  {isNpm && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Recommended
                    </span>
                  )}
                </div>
                {isNpm ? (
                  <>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Paste this into your project. npm will fetch the tarball
                      directly from your Icon Forge server.
                    </p>
                    <CopyableLine label="" value={installCmd} />
                    <p className="text-xs text-[var(--text-secondary)] pt-1">
                      Then import like any library:
                    </p>
                    <CopyableLine
                      label=""
                      value={importExample(framework, pkgName)}
                      multiline
                    />
                  </>
                ) : (
                  <>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {framework === 'flutter' || framework === 'kotlin'
                        ? 'This ecosystem requires a Git URL or local path for unpublished packages — install via local path:'
                        : framework === 'swiftui'
                          ? 'Swift Package Manager uses Git URLs or local paths — install as a local package:'
                          : 'For HTML/CSS just use the direct URLs below — no install needed.'}
                    </p>
                    <CopyableLine label="" value={installCmd} multiline />
                    {framework !== 'html' && (
                      <p className="text-xs text-[var(--text-muted)]">
                        Download the zip below and extract it next to your project.
                      </p>
                    )}
                  </>
                )}
              </section>

              <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]/40 p-4">
                <h3 className="text-sm font-semibold tracking-tight">
                  2. Direct URL (no install at all)
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Any framework can use these URLs as <code>{'<img src>'}</code>{' '}
                  or via SVG <code>{'<use href>'}</code>. The server handles
                  caching and CORS.
                </p>
                <CopyableLine label="Single icon (raw SVG)" value={sampleSvgUrl} />
                <CopyableLine
                  label="All icons in this style (sprite)"
                  value={spriteUrl}
                />
                <CopyableLine
                  label="Sprite usage example"
                  value={`<svg width="32" height="32"><use href="${spriteUrl}#if-laptop" /></svg>`}
                  multiline
                />
              </section>

              <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]/40 p-4">
                <h3 className="text-sm font-semibold tracking-tight">
                  3. Download archive
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Useful for offline distribution, committing the icons into your
                  repo, or publishing to npm/pub.dev/Maven yourself.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleDownload('zip')}
                    disabled={downloading !== null}
                    className="h-10 px-4 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)] text-sm font-medium transition disabled:opacity-50"
                  >
                    {downloading === 'zip' ? 'Building…' : '↓ Download .zip'}
                  </button>
                  {isNpm && (
                    <button
                      onClick={() => handleDownload('tgz')}
                      disabled={downloading !== null}
                      className="h-10 px-4 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)] text-sm font-medium transition disabled:opacity-50"
                    >
                      {downloading === 'tgz' ? 'Building…' : '↓ Download .tgz'}
                    </button>
                  )}
                </div>
              </section>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-300 p-3">
                  {error}
                </div>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
