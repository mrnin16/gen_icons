import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Public signup is disabled. AI generation costs tokens, so only the seeded
// admin user is allowed to log in. To create additional users, run the
// `npm run db:seed:admin` script (or insert directly via Prisma) — never
// re-enable this endpoint without putting it behind admin auth + rate limit.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Signups are disabled' },
    { status: 403 },
  );
}
