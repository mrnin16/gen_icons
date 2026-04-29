'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import clsx from 'clsx';

import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { IconGrid } from '@/components/IconGrid';
import { Pagination } from '@/components/Pagination';
import { SkeletonGrid } from '@/components/SkeletonGrid';
import type { CategoriesResponse, IconDTO, IconsResponse } from '@/lib/types';

const IconDetailModal = dynamic(
  () => import('@/components/IconDetailModal').then((m) => m.IconDetailModal),
  { ssr: false },
);
const AiGenerator = dynamic(
  () => import('@/components/AiGenerator').then((m) => m.AiGenerator),
  { ssr: false },
);
const BundleExporter = dynamic(
  () => import('@/components/BundleExporter').then((m) => m.BundleExporter),
  { ssr: false },
);

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function HomeInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const query = sp.get('q') ?? '';
  const category = sp.get('category') ?? '';
  const style = sp.get('style') ?? '';
  const source = sp.get('source') ?? '';
  const sort = sp.get('sort') ?? 'popular';
  const page = parseInt(sp.get('page') ?? '1', 10) || 1;

  const updateParams = useCallback(
    (
      patch: Record<string, string | number | undefined>,
      opts: { resetPage?: boolean } = {},
    ) => {
      const next = new URLSearchParams(sp.toString());
      Object.entries(patch).forEach(([k, v]) => {
        if (v === undefined || v === '' || v === null) next.delete(k);
        else next.set(k, String(v));
      });
      if (opts.resetPage !== false && !('page' in patch)) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `/?${qs}` : '/', { scroll: false });
    },
    [router, sp],
  );

  const apiUrl = useMemo(() => {
    const u = new URLSearchParams();
    u.set('page', String(page));
    u.set('limit', '40');
    if (query) u.set('q', query);
    if (category) u.set('category', category);
    if (style) u.set('style', style);
    if (source) u.set('source', source);
    if (sort) u.set('sort', sort);
    return `/api/icons?${u.toString()}`;
  }, [query, category, style, source, sort, page]);

  const { data, isLoading, mutate } = useSWR<IconsResponse>(apiUrl, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  const { data: catsData, mutate: mutateCats } = useSWR<CategoriesResponse>(
    '/api/icons/categories',
    fetcher,
    { revalidateOnFocus: false },
  );

  const categoryCounts = useMemo<Record<string, number>>(() => {
    const acc: Record<string, number> = {};
    catsData?.categories.forEach((c) => {
      acc[c.name] = c.count;
    });
    return acc;
  }, [catsData]);

  const totalCount = useMemo(
    () => catsData?.categories.reduce((sum, c) => sum + c.count, 0) ?? 0,
    [catsData],
  );

  const [selectedIcon, setSelectedIcon] = useState<IconDTO | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);

  const handleGenerated = useCallback(
    (icon: IconDTO) => {
      setSelectedIcon(icon);
      mutate();
      mutateCats();
    },
    [mutate, mutateCats],
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        query={query}
        onQueryChange={(q) => updateParams({ q })}
        onOpenGenerator={() => setGeneratorOpen(true)}
        onOpenBundle={() => setBundleOpen(true)}
      />

      <div className="flex flex-1">
        <Sidebar
          category={category}
          style={style}
          source={source}
          categoryCounts={categoryCounts}
          totalCount={totalCount}
          onChange={(patch) => updateParams(patch)}
        />

        <main className="flex-1 min-w-0 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="text-sm text-[var(--text-secondary)]">
              {data ? (
                <>
                  Showing{' '}
                  <span className="text-[var(--text-primary)] font-medium">
                    {data.icons.length}
                  </span>{' '}
                  of{' '}
                  <span className="text-[var(--text-primary)] font-medium">
                    {data.pagination.total}
                  </span>{' '}
                  icons
                </>
              ) : (
                'Loading…'
              )}
            </div>
            <div className="flex items-center gap-1 p-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border)]">
              {(['popular', 'newest', 'name'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updateParams({ sort: s })}
                  className={clsx(
                    'h-7 px-3 rounded-sm text-xs font-medium transition',
                    sort === s
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {s === 'popular' ? 'Popular' : s === 'newest' ? 'Newest' : 'A–Z'}
                </button>
              ))}
            </div>
          </div>

          {isLoading && !data ? (
            <SkeletonGrid count={24} />
          ) : (
            <>
              <IconGrid icons={data?.icons ?? []} onSelect={setSelectedIcon} />
              <Pagination
                page={page}
                totalPages={data?.pagination.totalPages ?? 1}
                onPageChange={(p) => updateParams({ page: p }, { resetPage: false })}
              />
            </>
          )}
        </main>
      </div>

      <IconDetailModal icon={selectedIcon} onClose={() => setSelectedIcon(null)} />
      <AiGenerator
        open={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onGenerated={handleGenerated}
      />
      <BundleExporter
        open={bundleOpen}
        onClose={() => setBundleOpen(false)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="p-8 text-[var(--text-muted)]">Loading…</div>}>
      <HomeInner />
    </Suspense>
  );
}
