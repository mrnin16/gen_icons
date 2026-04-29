/* eslint-disable no-console */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { ICON_DEFINITIONS } from './icon-definitions';
import { LUCIDE_MAPPING } from './lucide-mapping';
import {
  STYLE_BUILDERS,
  STYLE_IDS,
  extractInner,
  type StyleId,
} from './style-transformers';
import { kebabCase } from '../src/lib/svg-utils';

const ICONS_DIR = path.resolve(
  process.cwd(),
  'node_modules/lucide-static/icons',
);

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let missing = 0;

  const totalPlanned = ICON_DEFINITIONS.length * STYLE_IDS.length;
  console.log(
    `🪄 Seeding platform-default icons: ${ICON_DEFINITIONS.length} defs × ${STYLE_IDS.length} styles = ${totalPlanned}\n`,
  );

  for (const def of ICON_DEFINITIONS) {
    const lucideName = LUCIDE_MAPPING[def.name];
    if (!lucideName) {
      missing += STYLE_IDS.length;
      console.warn(`✗ no mapping for "${def.name}" (skipping all styles)`);
      continue;
    }
    const filePath = path.join(ICONS_DIR, `${lucideName}.svg`);
    if (!fs.existsSync(filePath)) {
      missing += STYLE_IDS.length;
      console.warn(`✗ lucide '${lucideName}.svg' missing for "${def.name}"`);
      continue;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const inner = extractInner(raw);

    for (const style of STYLE_IDS as StyleId[]) {
      const slug = `${kebabCase(def.name)}-${style}`;
      const svg = STYLE_BUILDERS[style](inner, slug);

      const existing = await prisma.icon.findUnique({ where: { slug } });
      if (existing) {
        if (existing.svgContent === svg) {
          skipped += 1;
          continue;
        }
        await prisma.icon.update({
          where: { slug },
          data: {
            svgContent: svg,
            name: def.name,
            category: def.category,
            tags: def.tags,
            style,
            isAiGenerated: false,
          },
        });
        updated += 1;
        continue;
      }

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
    }
  }

  console.log(
    `\nDone. created=${created}, updated=${updated}, skipped=${skipped}, missing=${missing}`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
