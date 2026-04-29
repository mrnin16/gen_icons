/* eslint-disable no-console */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { ICON_DEFINITIONS } from './icon-definitions';
import { STYLE_PROMPTS, SYSTEM_PROMPT } from '../src/lib/ai-prompts';
import { stripBackgroundRect, kebabCase } from '../src/lib/svg-utils';

const PRIMARY_STYLES = ['flat-modern', 'line-art'];
const REQUEST_DELAY_MS = 400;
const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateOne(
  anthropic: Anthropic,
  name: string,
  style: string,
): Promise<string | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Create an icon of: "${name}"\n\nStyle:\n${STYLE_PROMPTS[style]}\n\nOutput ONLY raw SVG with TRANSPARENT background.`,
          },
        ],
      });

      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);
      if (svgMatch) return stripBackgroundRect(svgMatch[0]);
      console.warn(`  ⚠ no <svg> in response (attempt ${attempt})`);
    } catch (err) {
      console.warn(`  ⚠ attempt ${attempt} failed:`, (err as Error).message);
      await sleep(2000 * attempt);
    }
  }
  return null;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY is not set in .env');
    process.exit(1);
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });
  const anthropic = new Anthropic({ apiKey });

  const total = ICON_DEFINITIONS.length * PRIMARY_STYLES.length;
  let done = 0;
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const startedAt = Date.now();

  console.log(
    `🔨 Forging ${total} icons (${ICON_DEFINITIONS.length} definitions × ${PRIMARY_STYLES.length} styles)…\n`,
  );

  for (const def of ICON_DEFINITIONS) {
    for (const style of PRIMARY_STYLES) {
      done += 1;
      const slug = `${kebabCase(def.name)}-${style}`;
      const existing = await prisma.icon.findUnique({ where: { slug } });
      if (existing) {
        skipped += 1;
        console.log(`[${done}/${total}] ↻ skip   ${slug} (exists)`);
        continue;
      }

      const tStart = Date.now();
      const svg = await generateOne(anthropic, def.name, style);
      if (!svg) {
        failed += 1;
        console.log(`[${done}/${total}] ✗ fail   ${slug}`);
        continue;
      }

      try {
        await prisma.icon.create({
          data: {
            name: def.name,
            slug,
            svgContent: svg,
            category: def.category,
            style,
            tags: def.tags,
            isAiGenerated: false,
          },
        });
        created += 1;
        const dt = ((Date.now() - tStart) / 1000).toFixed(1);
        console.log(`[${done}/${total}] ✓ create ${slug} (${dt}s)`);
      } catch (e) {
        failed += 1;
        console.warn(`[${done}/${total}] ✗ db     ${slug}:`, (e as Error).message);
      }
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
  console.log(
    `\nDone in ${mins}min. created=${created}, skipped=${skipped}, failed=${failed}`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
