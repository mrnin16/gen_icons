import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/icons/:slug/visibility
 * Admin-only. Body: { isPublic: boolean }. Toggles whether an AI-generated
 * icon is visible to anonymous visitors. Platform-default icons are always
 * public — refusing to mutate them keeps the catalog stable.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/icons/[slug]/visibility'>) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: { isPublic?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.isPublic !== 'boolean') {
    return NextResponse.json({ error: '`isPublic` must be a boolean' }, { status: 400 });
  }

  const { slug } = await ctx.params;
  const icon = await prisma.icon.findUnique({
    where: { slug },
    select: { id: true, isAiGenerated: true, isPublic: true },
  });
  if (!icon) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!icon.isAiGenerated) {
    return NextResponse.json(
      { error: 'Platform-default icons are always public — visibility cannot be toggled' },
      { status: 409 },
    );
  }

  const updated = await prisma.icon.update({
    where: { id: icon.id },
    data: { isPublic: body.isPublic },
    select: { id: true, slug: true, isPublic: true },
  });

  return NextResponse.json({ icon: updated });
}
