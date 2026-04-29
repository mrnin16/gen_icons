import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/icons/[slug]'>) {
  const { slug } = await ctx.params;
  const icon = await prisma.icon.findUnique({ where: { slug } });
  if (!icon) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.icon.update({
    where: { id: icon.id },
    data: { downloads: { increment: 1 } },
  });

  return NextResponse.json({ icon });
}
