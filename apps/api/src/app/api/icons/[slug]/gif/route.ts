import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const GIF_SIZE = 128;

type AnimationData = {
  frames: string[];
  durationMs: number;
};

async function renderSvgToPixels(svgStr: string, size: number): Promise<Uint8Array> {
  const { Resvg } = await import('@resvg/resvg-js');
  const sized = svgStr.replace(
    /<svg([^>]*)>/i,
    `<svg$1 width="${size}" height="${size}">`,
  );
  const resvg = new Resvg(sized, { fitTo: { mode: 'width', value: size } });
  const png = resvg.render();
  return png.pixels; // raw RGBA bytes
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/icons/[slug]/gif'>) {
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
      { error: 'GIF export is only available for animated icons.' },
      { status: 400 },
    );
  }

  let animData: AnimationData;
  try {
    animData = JSON.parse(icon.animationData) as AnimationData;
    if (!Array.isArray(animData.frames) || animData.frames.length === 0) {
      throw new Error('No frames');
    }
  } catch {
    return NextResponse.json({ error: 'Failed to parse animation data' }, { status: 500 });
  }

  const { frames, durationMs } = animData;
  const delayMs = Math.round(durationMs / frames.length);
  const gifDelay = Math.max(2, Math.round(delayMs / 10)); // GIF delay is in 1/100ths of a second

  try {
    const GifEncoder = (await import('gif-encoder-2')).default;
    const encoder = new GifEncoder(GIF_SIZE, GIF_SIZE, 'neuquant', true);
    encoder.setDelay(gifDelay);
    encoder.setRepeat(0); // loop forever
    encoder.setQuality(10);
    encoder.start();

    for (const frameSvg of frames) {
      const pixels = await renderSvgToPixels(frameSvg, GIF_SIZE);
      // gif-encoder-2 expects Buffer of RGBA
      const buf = Buffer.from(pixels);
      encoder.addFrame(buf as unknown as Uint8ClampedArray);
    }

    encoder.finish();
    const gifBuffer = encoder.out.getData();

    return new NextResponse(gifBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Disposition': `attachment; filename="${slug}.gif"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    console.error('GIF generation error:', err);
    const msg = err instanceof Error ? err.message : 'GIF generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
