/**
 * GET /api/referrals/me
 *
 * Returns the current user's referral code + stats.
 * Auto-creates a code if none exists yet.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq, count } from 'drizzle-orm';

import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';

export const runtime = 'nodejs';

function generateCode(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
}

export async function GET(): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const userId = guard.user.id;

  // Find or create referral code
  let codeRow = await db.query.referralCodes.findFirst({
    where: eq(schema.referralCodes.ownerId, userId),
  });

  if (!codeRow) {
    let code = generateCode();
    // Retry on collision (extremely rare with nanoid(10))
    let attempts = 0;
    while (attempts < 3) {
      const existing = await db.query.referralCodes.findFirst({
        where: eq(schema.referralCodes.code, code),
      });
      if (!existing) break;
      code = generateCode();
      attempts++;
    }

    const [inserted] = await db
      .insert(schema.referralCodes)
      .values({ ownerId: userId, code })
      .returning();
    codeRow = inserted;
  }

  // Stats
  const [referredCount] = await db
    .select({ value: count() })
    .from(schema.referrals)
    .where(eq(schema.referrals.referrerId, userId));

  const qualifiedCount = await db.query.referrals.findMany({
    where: eq(schema.referrals.referrerId, userId),
    columns: { status: true },
  });

  return NextResponse.json({
    code: codeRow?.code,
    usageCount: codeRow?.usageCount ?? 0,
    referredCount: referredCount?.value ?? 0,
    qualifiedCount: qualifiedCount.filter((r) => r.status !== 'pending').length,
  });
}
