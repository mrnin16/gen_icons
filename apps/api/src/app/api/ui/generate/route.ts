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
  if (prompt.length > 600) {
    return NextResponse.json({ error: 'Prompt too long (max 600 chars)' }, { status: 400 });
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

// Lightweight syntactic check. Catches the common failure modes (truncated
// output, missing braces) without dragging a parser into the request path.
// Returns null when looks-balanced, or a short reason when not.
function validateJsx(jsx: string): string | null {
  if (!jsx || !/function\s+App\s*\(/.test(jsx)) {
    return 'no `function App` found';
  }
  // Must end with a closing brace (allowing trailing whitespace/newlines).
  if (!/}\s*$/.test(jsx)) {
    return 'output did not end with a closing `}` — likely truncated';
  }
  // Walk the string ignoring contents inside strings, template literals,
  // line comments, and block comments. Track balance of (), {}, [].
  let i = 0;
  const n = jsx.length;
  let pa = 0, br = 0, sq = 0;
  while (i < n) {
    const c = jsx[i];
    const c2 = jsx[i + 1];
    // line comment
    if (c === '/' && c2 === '/') {
      while (i < n && jsx[i] !== '\n') i++;
      continue;
    }
    // block comment
    if (c === '/' && c2 === '*') {
      i += 2;
      while (i < n - 1 && !(jsx[i] === '*' && jsx[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // single-quoted string
    if (c === "'") {
      i++;
      while (i < n && jsx[i] !== "'") {
        if (jsx[i] === '\\') i += 2;
        else i++;
      }
      i++;
      continue;
    }
    // double-quoted string
    if (c === '"') {
      i++;
      while (i < n && jsx[i] !== '"') {
        if (jsx[i] === '\\') i += 2;
        else i++;
      }
      i++;
      continue;
    }
    // template literal — skip whole template, including ${...} which is
    // tracked separately for balance? For safety we recurse: nested ${}
    // contributes to brace count. Simpler approach: skip until matching
    // backtick, treating ${ ... } depth as part of {} balance.
    if (c === '`') {
      i++;
      while (i < n && jsx[i] !== '`') {
        if (jsx[i] === '\\') { i += 2; continue; }
        if (jsx[i] === '$' && jsx[i + 1] === '{') {
          // track expression braces inside template
          let depth = 1;
          i += 2;
          while (i < n && depth > 0) {
            if (jsx[i] === '{') depth++;
            else if (jsx[i] === '}') depth--;
            else if (jsx[i] === '\\') i++;
            i++;
          }
          continue;
        }
        i++;
      }
      i++;
      continue;
    }
    if (c === '(') pa++;
    else if (c === ')') pa--;
    else if (c === '{') br++;
    else if (c === '}') br--;
    else if (c === '[') sq++;
    else if (c === ']') sq--;
    if (pa < 0 || br < 0 || sq < 0) {
      return `unbalanced ${c}`;
    }
    i++;
  }
  if (pa !== 0) return `unbalanced parentheses (${pa} open)`;
  if (br !== 0) return `unbalanced braces (${br} open)`;
  if (sq !== 0) return `unbalanced brackets (${sq} open)`;
  return null;
}
