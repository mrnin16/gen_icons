/* eslint-disable no-console */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { ANIMATED_ICONS } from './animated-transformers';

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

  console.log(`🎬 Seeding animated icons: ${ANIMATED_ICONS.length} icons\n`);

  for (const spec of ANIMATED_ICONS) {
    const output = spec.build();

    const existing = await prisma.icon.findUnique({ where: { slug: spec.slug } });
    if (existing) {
      if (
        existing.svgContent === output.svgContent &&
        existing.animationData === output.animationData
      ) {
        skipped++;
        continue;
      }
      await prisma.icon.update({
        where: { slug: spec.slug },
        data: {
          name: spec.name,
          svgContent: output.svgContent,
          category: spec.category,
          style: 'animated',
          tags: spec.tags,
          iconType: 'animated',
          animationData: output.animationData,
          isAiGenerated: false,
        },
      });
      updated++;
      continue;
    }

    await prisma.icon.create({
      data: {
        name: spec.name,
        slug: spec.slug,
        svgContent: output.svgContent,
        category: spec.category,
        style: 'animated',
        tags: spec.tags,
        iconType: 'animated',
        animationData: output.animationData,
        isAiGenerated: false,
      },
    });
    created++;
  }

  console.log(`\nDone. created=${created}, updated=${updated}, skipped=${skipped}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
