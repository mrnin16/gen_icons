import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { generateTextWithFallback, modelFor } from '@/lib/ai-providers';
import {
  UI_SYSTEM_PROMPT,
  UI_SLIDES_SYSTEM_PROMPT,
  UI_REFINE_SYSTEM_PROMPT,
  UI_SLIDES_REFINE_SYSTEM_PROMPT,
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

  let body: { prompt?: string; mode?: 'page' | 'slides'; baseJsx?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const prompt = (body.prompt || '').trim();
  const mode = body.mode === 'slides' ? 'slides' : 'page';
  const baseJsx = (body.baseJsx || '').trim();

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
  }
  // Soft cap to keep token usage bounded; should be far above any sensible
  // human-written prompt. Bumped well beyond the previous 600 so the
  // composer feels unconstrained (Claude-style).
  if (prompt.length > 8000) {
    return NextResponse.json({ error: 'Prompt too long (max 8000 chars)' }, { status: 400 });
  }

  const isRefine = !!baseJsx && /function\s+App\s*\(/.test(baseJsx);
  const system = isRefine
    ? (mode === 'slides' ? UI_SLIDES_REFINE_SYSTEM_PROMPT : UI_REFINE_SYSTEM_PROMPT)
    : (mode === 'slides' ? UI_SLIDES_SYSTEM_PROMPT : UI_SYSTEM_PROMPT);

  const userMessage = isRefine
    ? `CURRENT App component:\n\n\`\`\`jsx\n${baseJsx}\n\`\`\`\n\nChange request:\n${prompt}`
    : prompt;

  try {
    // First attempt
    let result = await generateTextWithFallback({
      system,
      user: userMessage,
      maxTokens: 8000,
    });
    let jsx = stripCodeFence(result.text);
    let problem = validateJsx(jsx);

    // One retry with explicit guidance if the first attempt was malformed
    // (most common cause: token-truncated output that left braces unclosed).
    if (problem) {
      result = await generateTextWithFallback({
        system,
        user:
          userMessage +
          `\n\nIMPORTANT: your previous output had a problem: ${problem}. Output the COMPLETE App component this time, balancing every brace and ending with the matching \`}\`. Keep it concise enough to fit in your reply.`,
        maxTokens: 8000,
      });
      jsx = stripCodeFence(result.text);
      problem = validateJsx(jsx);
    }

    if (problem) {
      return NextResponse.json(
        { error: `Model output was malformed (${problem}). Try a shorter prompt or click Try again.` },
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

// Cheap, reliable malformed-output check. Hand-rolled balance walkers always
// false-positive on JSX (regex literals, JSX text, character-class braces,
// etc.) so we only enforce the markers that are dead simple to verify and
// that catch the failure case we actually care about — token-truncated output.
//
// If JSX is syntactically off in subtler ways the iframe's in-page error UI
// surfaces it and the user can hit Try again.
function validateJsx(jsx: string): string | null {
  if (!jsx || !/function\s+App\s*\(/.test(jsx)) {
    return 'no `function App` found';
  }
  if (!/}\s*$/.test(jsx)) {
    return 'output did not end with a closing `}` — likely truncated';
  }
  return null;
}
