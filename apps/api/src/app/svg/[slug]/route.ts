import { prisma } from '@/lib/prisma';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Public direct-use SVG endpoint.
 *
 * Usage from anywhere: `<img src="http://localhost:3000/svg/laptop-line-art" />`
 * Returns the raw SVG body with the right Content-Type and permissive CORS.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/svg/[slug]'>,
) {
  const { slug: rawSlug } = await ctx.params;
  const slug = rawSlug.replace(/\.svg$/i, '');

  const icon = await prisma.icon.findUnique({
    where: { slug },
    select: { svgContent: true },
  });

  if (!icon) {
    return new Response(`<!-- icon not found: ${slug} -->`, {
      status: 404,
      headers: { 'content-type': 'image/svg+xml; charset=utf-8' },
    });
  }

  return new Response(icon.svgContent, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
      'access-control-allow-origin': '*',
    },
  });
}
