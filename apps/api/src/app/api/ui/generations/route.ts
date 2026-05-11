import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to view history' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(60, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));
  const cursor = searchParams.get('cursor') || undefined;

  // Cursor pagination: callers pass back the id of the last row from the
  // previous page to get the next page (createdAt desc, id is the secondary
  // tiebreaker via Prisma's cursor).
  const rows = await prisma.uiGeneration.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      prompt: true,
      mode: true,
      isRefine: true,
      provider: true,
      model: true,
      aspectRatio: true,
      brandColor: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return NextResponse.json({ items, nextCursor });
}
