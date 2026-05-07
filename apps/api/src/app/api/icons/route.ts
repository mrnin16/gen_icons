import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(120, Math.max(1, parseInt(searchParams.get('limit') || '40', 10)));
  const search = (searchParams.get('q') || '').trim();
  const category = searchParams.get('category') || '';
  const style = searchParams.get('style') || '';
  const source = searchParams.get('source') || ''; // '' | 'platform' | 'ai' | 'animated'
  const mine = searchParams.get('mine') === '1';
  const sort = searchParams.get('sort') || 'popular';

  const user = await getCurrentUser();

  const filters: Prisma.IconWhereInput = {};
  if (category) filters.category = category;
  if (style) filters.style = style;
  if (source === 'ai') filters.isAiGenerated = true;
  if (source === 'platform') { filters.isAiGenerated = false; filters.iconType = 'static'; }
  if (source === 'animated') filters.iconType = 'animated';

  if (search) {
    filters.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { tags: { has: search.toLowerCase() } },
      { prompt: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Visibility:
  //   • Platform defaults (isAiGenerated=false) are public.
  //   • AI icons published by an admin (isPublic=true) are public to everyone.
  //   • Otherwise an AI icon is visible only to its owner. Admins see all.
  //   • `?mine=1` narrows to icons the current user owns.
  const visibility: Prisma.IconWhereInput | null = mine
    ? user ? { userId: user.id } : { id: '__no_match__' }
    : user?.role === 'ADMIN' ? null
    : user ? { OR: [{ isPublic: true }, { userId: user.id }] }
    : { isPublic: true };

  const where: Prisma.IconWhereInput = visibility
    ? { AND: [visibility, filters] }
    : filters;

  const orderBy: Prisma.IconOrderByWithRelationInput =
    sort === 'newest'
      ? { createdAt: 'desc' }
      : sort === 'name'
        ? { name: 'asc' }
        : { downloads: 'desc' };

  const [icons, total] = await Promise.all([
    prisma.icon.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        svgContent: true,
        category: true,
        style: true,
        tags: true,
        isAiGenerated: true,
        isPublic: true,
        iconType: true,
        animationData: true,
        downloads: true,
      },
    }),
    prisma.icon.count({ where }),
  ]);

  return NextResponse.json({
    icons,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
}
