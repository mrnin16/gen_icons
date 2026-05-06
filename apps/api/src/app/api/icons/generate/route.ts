import { prisma } from '@/lib/prisma';
import { STYLE_PROMPTS, detectCategory } from '@/lib/ai-prompts';
import {
  fallbackChain,
  generateWithFallback,
  modelFor,
} from '@/lib/ai-providers';
import { getCurrentUser } from '@/lib/auth';
import { stripBackgroundRect, kebabCase } from '@iconforge/shared';
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RATE_BUCKETS = new Map<string, number[]>();
function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = RATE_BUCKETS.get(key) ?? [];
  const fresh = arr.filter((t) => now - t < windowMs);
  if (fresh.length >= max) return false;
  fresh.push(now);
  RATE_BUCKETS.set(key, fresh);
  return true;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to generate icons' },
      { status: 401 },
    );
  }

  const chain = fallbackChain();
  if (chain.length === 0) {
    return NextResponse.json(
      {
        error:
          'No AI provider is configured. Set at least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, XAI_API_KEY in .env.',
      },
      { status: 500 },
    );
  }

  if (!rateLimit(`gen:${user.id}`, 10, 60_000)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded — max 10 generations per minute' },
      { status: 429 },
    );
  }

  let body: { prompt?: string; style?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const prompt = (body.prompt || '').trim();
  const style = body.style || 'flat-modern';

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
  }
  if (prompt.length > 200) {
    return NextResponse.json({ error: 'Prompt too long (max 200 chars)' }, { status: 400 });
  }
  if (!STYLE_PROMPTS[style]) {
    return NextResponse.json({ error: `Unknown style: ${style}` }, { status: 400 });
  }

  try {
    const result = await generateWithFallback({ prompt, style });
    const svg = stripBackgroundRect(result.svg);
    const slug = `${kebabCase(prompt)}-${style}-${Date.now().toString(36)}`;
    const isAnimated = style === 'animated';
    const category = isAnimated ? 'animated' : detectCategory(prompt);

    const icon = await prisma.icon.create({
      data: {
        name: prompt,
        slug,
        svgContent: svg,
        category,
        style,
        tags: prompt.toLowerCase().split(/\s+/).filter(Boolean),
        isAiGenerated: true,
        iconType: isAnimated ? 'animated' : 'static',
        prompt,
        userId: user.id,
      },
    });

    return NextResponse.json({
      icon,
      provider: result.providerUsed,
      model: modelFor(result.providerUsed),
      attempts: result.attempts,
    });
  } catch (error) {
    console.error('Generation error:', error);
    const msg = error instanceof Error ? error.message : 'Icon generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
