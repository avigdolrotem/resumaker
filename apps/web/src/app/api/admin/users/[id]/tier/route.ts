/**
 * POST /api/admin/users/[id]/tier — grant or revoke a tier (admin only)
 *
 * Use this to give friends premium for free, or to revoke abuse.
 * Sets `grantedBy` to the admin id; webhook handler will not overwrite
 * admin-granted rows unless explicitly told to.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';

const BodySchema = z.object({
  tier: z.enum(['free', 'plus', 'pro']),
  notes: z.string().max(500).optional(),
  /** ISO timestamp; null = forever. Optional, defaults to null. */
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const caller = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: { role: true },
  });
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const target = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
    columns: { email: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const existing = await db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.userId, id),
    columns: { tier: true },
  });

  // Build the update set. Only touch `currentPeriodEnd` / `cancelAtPeriodEnd`
  // if the admin explicitly provided `expiresAt`. Otherwise leave them alone —
  // wiping them on every grant would clobber an active Stripe/LS subscription's
  // renewal date.
  const updateValues: Record<string, unknown> = {
    tier: body.tier,
    status: 'active',
    grantedBy: session.user.id,
    notes: body.notes ?? null,
    updatedAt: new Date(),
  };
  if (body.expiresAt !== undefined) {
    updateValues['currentPeriodEnd'] = body.expiresAt ? new Date(body.expiresAt) : null;
    updateValues['cancelAtPeriodEnd'] = false;
  }

  if (existing) {
    await db
      .update(schema.subscriptions)
      .set(updateValues)
      .where(eq(schema.subscriptions.userId, id));
  } else {
    await db.insert(schema.subscriptions).values({
      userId: id,
      provider: 'manual',
      ...updateValues,
    });
  }

  auditEvent({
    userId: session.user.id,
    event: 'admin_action',
    metadata: {
      kind: 'tier_grant',
      targetUserId: id,
      targetEmail: target.email,
      previousTier: existing?.tier ?? 'free',
      newTier: body.tier,
      notes: body.notes,
      expiresAt: body.expiresAt ?? null,
    },
  });

  return NextResponse.json({ success: true, tier: body.tier });
}
