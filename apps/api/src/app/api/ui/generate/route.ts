import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { generateTextWithFallback, modelFor } from '@/lib/ai-providers';
import {
  UI_SYSTEM_PROMPT,
  UI_SLIDES_SYSTEM_PROMPT,
  deriveTitle,
  stripCodeFence,
  wrapAsHtmlDoc,
} from '@/lib/ui-prompts';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

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
    return NextResponse.json({ error: 'Sign in to generate UIs' }, { status: 401 });
  }

  if (!rateLimit(`ui:${user.id}`, 8, 60_000)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded — max 8 generations per minute' },
      { status: 429 },
    );
  }

  let body: { prompt?: string; mode?: 'page' | 'slides' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const prompt = (body.prompt || '').trim();
  const mode = body.mode === 'slides' ? 'slides' : 'page';

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
  }
  if (prompt.length > 600) {
    return NextResponse.json({ error: 'Prompt too long (max 600 chars)' }, { status: 400 });
  }

  const system = mode === 'slides' ? UI_SLIDES_SYSTEM_PROMPT : UI_SYSTEM_PROMPT;

  try {
    const result = await generateTextWithFallback({
      system,
      user: prompt,
      maxTokens: 6000,
    });
    const jsx = stripCodeFence(result.text);

    if (!/function\s+App\s*\(/.test(jsx)) {
      return NextResponse.json(
        { error: 'Model did not produce a valid App component. Try rephrasing the prompt.' },
        { status: 502 },
      );
    }

    const title = deriveTitle(prompt);
    const html = wrapAsHtmlDoc(jsx, title);

    return NextResponse.json({
      title,
      jsx,
      html,
      provider: result.providerUsed,
      model: modelFor(result.providerUsed),
    });
  } catch (error) {
    console.error('UI generation error:', error);
    const msg = error instanceof Error ? error.message : 'UI generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
