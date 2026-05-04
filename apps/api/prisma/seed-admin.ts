import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  const email = (process.env.ADMIN_EMAIL || 'admin@iconforge.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin12345';

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'ADMIN', name: 'Administrator' },
    create: { email, passwordHash, role: 'ADMIN', name: 'Administrator' },
    select: { id: true, email: true, role: true },
  });
  console.log(`✓ Admin ready: ${user.email} (${user.role})`);
  console.log(`  Password: ${password}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
