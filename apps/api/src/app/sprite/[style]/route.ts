import { prisma } from '@/lib/prisma';
import { kebabCase } from '@iconforge/shared';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Sprite endpoint: returns one SVG document containing every icon for a given
 * style as `<symbol id="if-<slug>" viewBox="…">…</symbol>` so consumers can
 * reference icons via `<svg><use href="…/sprite/line-art#if-laptop"/></svg>`.
 *
 * Caches aggressively since sprites are immutable once seeded.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/sprite/[style]'>,
) {
  const { style: rawStyle } = await ctx.params;
  const style = rawStyle.replace(/\.svg$/i, '');

  const icons = await prisma.icon.findMany({
    where: { style, isAiGenerated: false },
    orderBy: { name: 'asc' },
    select: { name: true, svgContent: true },
  });

  if (icons.length === 0) {
    return new Response(`<!-- no icons for style: ${style} -->`, {
      status: 404,
      headers: { 'content-type': 'image/svg+xml; charset=utf-8' },
    });
  }

  const symbols = icons
    .map((i) => {
      const slug = kebabCase(i.name);
      const inner = i.svgContent.replace(
        /^[\s\S]*?<svg[^>]*>([\s\S]*?)<\/svg>\s*$/i,
        '$1',
      );
      const vb =
        i.svgContent.match(/viewBox=["']([^"']+)["']/i)?.[1] ?? '0 0 24 24';
      return `<symbol id="if-${slug}" viewBox="${vb}">${inner}</symbol>`;
    })
    .join('\n');

  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" data-style="${style}" data-count="${icons.length}">\n${symbols}\n</svg>\n`;

  return new Response(sprite, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
      'access-control-allow-origin': '*',
    },
  });
}
