import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { generateTextWithFallback, modelFor } from '@/lib/ai-providers';
import {
  UI_SYSTEM_PROMPT,
  UI_SLIDES_SYSTEM_PROMPT,
  UI_REFINE_SYSTEM_PROMPT,
  UI_SLIDES_REFINE_SYSTEM_PROMPT,
  UI_POSTER_SYSTEM_PROMPT,
  UI_POSTER_REFINE_SYSTEM_PROMPT,
  deriveTitle,
  stripCodeFence,
  wrapAsHtmlDoc,
} from '@/lib/ui-prompts';

const VALID_ASPECT_RATIOS = new Set(['1:1', '9:16', '4:5', '16:9']);
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
// Cap brand asset size at ~6MB per image (base64-inflated) so a single
// generate request stays well under typical body limits. The web client
// resizes uploads before hitting this, so this is a defense-in-depth check.
const MAX_ASSET_LEN = 8_000_000;

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

  let body: {
    prompt?: string;
    mode?: 'page' | 'slides' | 'poster';
    baseJsx?: string;
    aspectRatio?: string;
    brandColor?: string;
    logoDataUrl?: string;
    productDataUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const prompt = (body.prompt || '').trim();
  const mode: 'page' | 'slides' | 'poster' =
    body.mode === 'slides' ? 'slides' : body.mode === 'poster' ? 'poster' : 'page';
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

  // Poster-only inputs. Validate even when mode != poster — silently ignore
  // unrelated inputs rather than erroring, so the client can be lazy.
  const aspectRatio = mode === 'poster' ? (body.aspectRatio || '1:1') : null;
  if (aspectRatio && !VALID_ASPECT_RATIOS.has(aspectRatio)) {
    return NextResponse.json(
      { error: `Invalid aspectRatio. Must be one of: ${[...VALID_ASPECT_RATIOS].join(', ')}` },
      { status: 400 },
    );
  }
  const brandColor = mode === 'poster' ? (body.brandColor || '').trim() || null : null;
  if (brandColor && !HEX_COLOR_RE.test(brandColor)) {
    return NextResponse.json(
      { error: 'brandColor must be a 6-digit hex like #cc785c' },
      { status: 400 },
    );
  }
  const logoUrl = mode === 'poster' ? (body.logoDataUrl || '').trim() || null : null;
  const productUrl = mode === 'poster' ? (body.productDataUrl || '').trim() || null : null;
  if (logoUrl && logoUrl.length > MAX_ASSET_LEN) {
    return NextResponse.json({ error: 'Logo image is too large (max ~6MB)' }, { status: 413 });
  }
  if (productUrl && productUrl.length > MAX_ASSET_LEN) {
    return NextResponse.json({ error: 'Product image is too large (max ~6MB)' }, { status: 413 });
  }

  const isRefine = !!baseJsx && /function\s+App\s*\(/.test(baseJsx);
  const system = isRefine
    ? mode === 'slides'
      ? UI_SLIDES_REFINE_SYSTEM_PROMPT
      : mode === 'poster'
        ? UI_POSTER_REFINE_SYSTEM_PROMPT
        : UI_REFINE_SYSTEM_PROMPT
    : mode === 'slides'
      ? UI_SLIDES_SYSTEM_PROMPT
      : mode === 'poster'
        ? UI_POSTER_SYSTEM_PROMPT
        : UI_SYSTEM_PROMPT;

  // Poster mode needs explicit context about the target ratio and which
  // brand inputs are actually available — without ever sending the actual
  // data URLs (token-heavy and not useful to the model).
  const posterContext =
    mode === 'poster'
      ? `TARGET ASPECT RATIO: ${aspectRatio}\n` +
        `BRAND_COLOR is ${brandColor ? `available (${brandColor})` : 'NOT provided (empty string) — pick a tasteful palette from the prompt'}.\n` +
        `LOGO_URL is ${logoUrl ? 'available — place the brand logo tastefully' : 'NOT provided (empty string) — use a wordmark instead'}.\n` +
        `PRODUCT_URL is ${productUrl ? 'available — make the product the visual hero' : 'NOT provided (empty string) — lean on typography and shapes'}.\n\n`
      : '';

  const userMessage = isRefine
    ? `${posterContext}CURRENT App component:\n\n\`\`\`jsx\n${baseJsx}\n\`\`\`\n\nChange request:\n${prompt}`
    : `${posterContext}${prompt}`;

  // Refines have to regenerate the entire component with the change applied,
  // so they need a larger output budget than first-shot generations.
  const firstMaxTokens = isRefine ? 16000 : 12000;
  const retryMaxTokens = isRefine ? 24000 : 16000;

  try {
    // First attempt
    let result = await generateTextWithFallback({
      system,
      user: userMessage,
      maxTokens: firstMaxTokens,
    });
    let jsx = stripCodeFence(result.text);
    let problem = validateJsx(jsx);

    // One retry with explicit guidance if the first attempt was malformed.
    // The most common cause is token-truncated output (model stopped mid-line
    // because it ran out of budget). Give the retry a larger budget AND tell
    // the model to be concise so we trade complexity for completeness.
    if (problem) {
      result = await generateTextWithFallback({
        system,
        user:
          userMessage +
          `\n\nIMPORTANT: your previous output had a problem: ${problem}. Output the COMPLETE App component this time, ending with the matching closing \`}\`. If the page is large, simplify lower-priority sections so the FULL component fits in your reply — a complete simpler page beats a truncated detailed one.`,
        maxTokens: retryMaxTokens,
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
    const brand = mode === 'poster' ? { color: brandColor, logoUrl, productUrl } : undefined;
    const html = wrapAsHtmlDoc(jsx, title, brand);
    const providerUsed = result.providerUsed;
    const modelUsed = modelFor(providerUsed);

    // Auto-save the generation so the user can find it later in history.
    // Save failures must NOT fail the request — the user still gets their UI.
    let savedId: string | null = null;
    try {
      const saved = await prisma.uiGeneration.create({
        data: {
          userId: user.id,
          title,
          prompt,
          jsx,
          html,
          mode,
          isRefine,
          provider: providerUsed,
          model: modelUsed,
          aspectRatio,
          brandColor,
          logoUrl,
          productUrl,
        },
        select: { id: true },
      });
      savedId = saved.id;
    } catch (err) {
      console.error('UI generation auto-save failed:', err);
    }

    return NextResponse.json({
      id: savedId,
      title,
      jsx,
      html,
      provider: providerUsed,
      model: modelUsed,
      aspectRatio,
      brandColor,
      logoUrl,
      productUrl,
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
