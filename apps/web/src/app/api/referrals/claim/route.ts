/**
 * POST /api/referrals/claim
 *
 * Body: { code: string }
 * Called from signup flow when ?ref=CODE is present.
 * Records a referral row linking the new user to the code owner.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';

export const runtime = 'nodejs';

const Body = z.object({
  code: z.string().min(1).max(20).toUpperCase(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const referredId = guard.user.id;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  // Look up the code
  const codeRow = await db.query.referralCodes.findFirst({
    where: eq(schema.referralCodes.code, body.code),
  });

  if (!codeRow) {
    return NextResponse.json({ error: 'Code not found' }, { status: 404 });
  }

  // Prevent self-referral
  if (codeRow.ownerId === referredId) {
    return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 });
  }

  // Check max uses
  if (codeRow.maxUses !== null && codeRow.usageCount >= codeRow.maxUses) {
    return NextResponse.json(
      { error: 'This referral code has reached its limit' },
      { status: 400 },
    );
  }

  // Check if this user was already referred
  const existing = await db.query.referrals.findFirst({
    where: eq(schema.referrals.referredId, referredId),
  });

  if (existing) {
    return NextResponse.json({ error: 'Already referred' }, { status: 409 });
  }

  // Insert referral + increment usage count atomically
  await db.transaction(async (tx) => {
    await tx.insert(schema.referrals).values({
      referrerId: codeRow.ownerId,
      referredId,
      status: 'pending',
    });

    await tx
      .update(schema.referralCodes)
      .set({ usageCount: sql`${schema.referralCodes.usageCount} + 1` })
      .where(eq(schema.referralCodes.id, codeRow.id));
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
