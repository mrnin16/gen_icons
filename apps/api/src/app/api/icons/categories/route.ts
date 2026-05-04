import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  const where: Prisma.IconWhereInput | undefined =
    user?.role === 'ADMIN'
      ? undefined
      : user
        ? { OR: [{ isAiGenerated: false }, { userId: user.id }] }
        : { isAiGenerated: false };

  const categories = await prisma.icon.groupBy({
    by: ['category'],
    where,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  return NextResponse.json({
    categories: categories.map((c) => ({ name: c.category, count: c._count.id })),
  });
}
