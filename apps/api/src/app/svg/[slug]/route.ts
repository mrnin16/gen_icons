import { prisma } from '@/lib/prisma';
import { type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Public direct-use SVG endpoint for platform-default icons.
 *
 * Usage from anywhere: `<img src="http://localhost:3000/svg/laptop-line-art" />`
 * Owner-private AI icons require the owner's session cookie (or admin).
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/svg/[slug]'>,
) {
  const { slug: rawSlug } = await ctx.params;
  const slug = rawSlug.replace(/\.svg$/i, '');

  const icon = await prisma.icon.findUnique({
    where: { slug },
    select: { svgContent: true, userId: true, isAiGenerated: true },
  });

  const notFound = () =>
    new Response(`<!-- icon not found: ${slug} -->`, {
      status: 404,
      headers: { 'content-type': 'image/svg+xml; charset=utf-8' },
    });

  if (!icon) return notFound();

  if (icon.isAiGenerated) {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.id !== icon.userId)) {
      return notFound();
    }
  }

  return new Response(icon.svgContent, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': icon.isAiGenerated
        ? 'private, no-store'
        : 'public, max-age=3600, stale-while-revalidate=86400',
      'access-control-allow-origin': '*',
    },
  });
}
