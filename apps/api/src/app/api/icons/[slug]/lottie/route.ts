import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/icons/[slug]/lottie'>) {
  const { slug } = await ctx.params;
  const icon = await prisma.icon.findUnique({ where: { slug } });

  if (!icon) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (icon.isAiGenerated) {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.id !== icon.userId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  if (icon.iconType !== 'animated' || !icon.animationData) {
    return NextResponse.json(
      { error: 'This icon does not have animation data. Only animated icons support Lottie export.' },
      { status: 400 },
    );
  }

  let lottieJson: object;
  try {
    const parsed = JSON.parse(icon.animationData) as { lottie?: object };
    if (!parsed.lottie) throw new Error('No lottie field');
    lottieJson = parsed.lottie;
  } catch {
    return NextResponse.json({ error: 'Failed to parse animation data' }, { status: 500 });
  }

  const filename = `${slug}.json`;
  return new NextResponse(JSON.stringify(lottieJson, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
