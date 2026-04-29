import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = await prisma.icon.groupBy({
    by: ['category'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  return NextResponse.json({
    categories: categories.map((c) => ({ name: c.category, count: c._count.id })),
  });
}
