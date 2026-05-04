import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/icons/[slug]'>) {
  const { slug } = await ctx.params;
  const icon = await prisma.icon.findUnique({ where: { slug } });
  if (!icon) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Platform defaults (isAiGenerated=false) are public. AI icons require the
  // owner's session, or admin.
  if (icon.isAiGenerated) {
    const user = await getCurrentUser();
    const allowed = user && (user.role === 'ADMIN' || user.id === icon.userId);
    if (!allowed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  await prisma.icon.update({
    where: { id: icon.id },
    data: { downloads: { increment: 1 } },
  });

  return NextResponse.json({ icon });
}
