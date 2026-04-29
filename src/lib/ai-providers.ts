/**
 * Multi-provider abstraction for AI icon generation.
 *
 * The user picks a provider in the UI (only configured providers appear),
 * the server dispatches to the right adapter, every adapter returns the
 * extracted SVG string. Each provider only "exists" if its API key env var
 * is set, so the project works with any subset configured.
 */
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

import { STYLE_PROMPTS, SYSTEM_PROMPT } from './ai-prompts';

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'grok';

// ─── Switch the AI provider here ───────────────────────────────────────────
// One-line change. Make sure the matching <PROVIDER>_API_KEY is set in .env.
//   'anthropic' → Claude            (ANTHROPIC_API_KEY, ANTHROPIC_MODEL)
//   'openai'    → ChatGPT (OpenAI)  (OPENAI_API_KEY,    OPENAI_MODEL)
//   'gemini'    → Gemini (Google)   (GOOGLE_API_KEY,    GEMINI_MODEL)
//   'grok'      → Grok (xAI)        (XAI_API_KEY,       GROK_MODEL)
export const ACTIVE_PROVIDER: ProviderId = 'anthropic';

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  envKey: string;
  modelEnvKey: string;
  defaultModel: string;
  /** Provider-specific extra notes shown in the UI. */
  description: string;
};

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    envKey: 'ANTHROPIC_API_KEY',
    modelEnvKey: 'ANTHROPIC_MODEL',
    defaultModel: 'claude-sonnet-4-5',
    description: 'Strong at structured SVG generation.',
  },
  {
    id: 'openai',
    label: 'ChatGPT (OpenAI)',
    envKey: 'OPENAI_API_KEY',
    modelEnvKey: 'OPENAI_MODEL',
    defaultModel: 'gpt-5',
    description: 'Wide style coverage; good general output.',
  },
  {
    id: 'gemini',
    label: 'Gemini (Google)',
    envKey: 'GOOGLE_API_KEY',
    modelEnvKey: 'GEMINI_MODEL',
    defaultModel: 'gemini-2.5-pro',
    description: 'Fast and cost-effective.',
  },
  {
    id: 'grok',
    label: 'Grok (xAI)',
    envKey: 'XAI_API_KEY',
    modelEnvKey: 'GROK_MODEL',
    defaultModel: 'grok-4',
    description: 'OpenAI-compatible API at api.x.ai.',
  },
];

const PROVIDER_BY_ID: Record<ProviderId, ProviderConfig> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p]),
) as Record<ProviderId, ProviderConfig>;

export type ConfiguredProvider = {
  id: ProviderId;
  label: string;
  description: string;
  model: string;
};

export function getConfiguredProviders(): ConfiguredProvider[] {
  return PROVIDERS.filter((p) => Boolean(process.env[p.envKey])).map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    model: process.env[p.modelEnvKey] || p.defaultModel,
  }));
}

export function isProviderConfigured(id: ProviderId): boolean {
  const cfg = PROVIDER_BY_ID[id];
  return cfg ? Boolean(process.env[cfg.envKey]) : false;
}

export function modelFor(id: ProviderId): string {
  const cfg = PROVIDER_BY_ID[id];
  if (!cfg) throw new Error(`Unknown provider: ${id}`);
  return process.env[cfg.modelEnvKey] || cfg.defaultModel;
}

export type GenerateInput = {
  prompt: string;
  style: string;
};

export type GenerateOutput = {
  svg: string;
  rawText: string;
};

const MAX_TOKENS = 3000;

function userMessage({ prompt, style }: GenerateInput): string {
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS['flat-modern'];
  return `Create an icon of: "${prompt}"\n\nStyle:\n${stylePrompt}\n\nOutput ONLY raw SVG with TRANSPARENT background.`;
}

function extractSvg(rawText: string): string | null {
  const m = rawText.match(/<svg[\s\S]*?<\/svg>/i);
  return m ? m[0] : null;
}

// ─── Anthropic ─────────────────────────────────────────────────────────────
async function withAnthropic(input: GenerateInput): Promise<GenerateOutput> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: modelFor('anthropic'),
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage(input) }],
  });
  const rawText = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const svg = extractSvg(rawText);
  if (!svg) throw new Error('Anthropic response did not contain a valid <svg>');
  return { svg, rawText };
}

// ─── OpenAI ────────────────────────────────────────────────────────────────
async function withOpenAI(input: GenerateInput): Promise<GenerateOutput> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: modelFor('openai'),
    max_completion_tokens: MAX_TOKENS,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage(input) },
    ],
  });
  const rawText = response.choices[0]?.message?.content ?? '';
  const svg = extractSvg(rawText);
  if (!svg) throw new Error('OpenAI response did not contain a valid <svg>');
  return { svg, rawText };
}

// ─── Gemini ────────────────────────────────────────────────────────────────
async function withGemini(input: GenerateInput): Promise<GenerateOutput> {
  const client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  const model = client.getGenerativeModel({
    model: modelFor('gemini'),
    systemInstruction: SYSTEM_PROMPT,
  });
  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage(input) }],
      },
    ],
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
      temperature: 0.7,
    },
  });
  const rawText = result.response.text();
  const svg = extractSvg(rawText);
  if (!svg) throw new Error('Gemini response did not contain a valid <svg>');
  return { svg, rawText };
}

// ─── Grok (xAI, OpenAI-compatible) ─────────────────────────────────────────
async function withGrok(input: GenerateInput): Promise<GenerateOutput> {
  const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  });
  const response = await client.chat.completions.create({
    model: modelFor('grok'),
    max_completion_tokens: MAX_TOKENS,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage(input) },
    ],
  });
  const rawText = response.choices[0]?.message?.content ?? '';
  const svg = extractSvg(rawText);
  if (!svg) throw new Error('Grok response did not contain a valid <svg>');
  return { svg, rawText };
}

const ADAPTERS: Record<ProviderId, (input: GenerateInput) => Promise<GenerateOutput>> = {
  anthropic: withAnthropic,
  openai: withOpenAI,
  gemini: withGemini,
  grok: withGrok,
};

export async function generateIconWithProvider(
  provider: ProviderId,
  input: GenerateInput,
): Promise<GenerateOutput> {
  if (!isProviderConfigured(provider)) {
    const cfg = PROVIDER_BY_ID[provider];
    throw new Error(
      `Provider "${provider}" is not configured. Set ${cfg?.envKey ?? '<API_KEY>'} on the server.`,
    );
  }
  const fn = ADAPTERS[provider];
  if (!fn) throw new Error(`Unknown provider: ${provider}`);
  return await fn(input);
}

/**
 * Build the ordered list of providers to try: prefer ACTIVE_PROVIDER if it's
 * configured, then the rest of configured providers in declaration order.
 */
export function fallbackChain(): ProviderId[] {
  const order = PROVIDERS.map((p) => p.id);
  const active = ACTIVE_PROVIDER;
  const rest = order.filter((id) => id !== active);
  const candidates = [active, ...rest];
  return candidates.filter((id) => isProviderConfigured(id));
}

export type GenerateWithFallbackResult = GenerateOutput & {
  providerUsed: ProviderId;
  attempts: { provider: ProviderId; ok: boolean; error?: string }[];
};

/**
 * Try each configured provider in fallback order until one succeeds.
 * Throws if every provider fails (or none are configured).
 */
export async function generateWithFallback(
  input: GenerateInput,
): Promise<GenerateWithFallbackResult> {
  const chain = fallbackChain();
  if (chain.length === 0) {
    throw new Error(
      'No AI provider is configured. Set at least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, XAI_API_KEY in .env.',
    );
  }

  const attempts: GenerateWithFallbackResult['attempts'] = [];
  for (const id of chain) {
    try {
      const out = await ADAPTERS[id](input);
      attempts.push({ provider: id, ok: true });
      return { ...out, providerUsed: id, attempts };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      attempts.push({ provider: id, ok: false, error: msg });
      console.warn(`[ai] ${id} failed:`, msg);
    }
  }

  const detail = attempts
    .map((a) => `${a.provider}: ${a.error ?? 'unknown'}`)
    .join(' | ');
  throw new Error(`All configured providers failed. ${detail}`);
}
