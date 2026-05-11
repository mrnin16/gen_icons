import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await prisma.uiGeneration.findUnique({ where: { id } });

  // Hide existence from non-owners — 404 rather than 403 so we don't leak ids.
  if (!row || row.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ generation: row });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await prisma.uiGeneration.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!row || row.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.uiGeneration.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
