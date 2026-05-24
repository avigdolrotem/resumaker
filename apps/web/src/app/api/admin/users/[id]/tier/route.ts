/**
 * POST /api/admin/users/[id]/tier — grant or revoke a tier (admin only)
 *
 * Use this to give friends premium for free, or to revoke abuse.
 * Sets `grantedBy` to the admin id; webhook handler will not overwrite
 * admin-granted rows unless explicitly told to.
 *
 * Safety guard: if the target has an active PAID subscription (provider
 * stripe/lemonsqueezy) with currentPeriodEnd in the future, refuse to
 * shorten it. Returns 409 unless `?force=1` is passed. Prevents the
 * "admin accidentally took 6 months off the user who just paid" failure
 * mode the operator flagged.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { TIER_ORDER } from '@/lib/billing/limits';
import { requireAdmin } from '@/lib/auth-guards';

const BodySchema = z.object({
  tier: z.enum(['free', 'plus', 'pro']),
  notes: z.string().max(500).optional(),
  /** ISO timestamp; null = forever. Optional, defaults to leaving the existing value alone. */
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const force = req.nextUrl.searchParams.get('force') === '1';

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
    columns: { id: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const existing = await db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.userId, id),
    columns: { tier: true, provider: true, currentPeriodEnd: true, status: true },
  });

  // ─── Safety guard: don't shorten a paid subscription ──────────────
  // Only applies when the existing row is from a paid provider (stripe/
  // lemonsqueezy) and is still active. Manual grants and free rows are
  // always safe to overwrite.
  if (existing && existing.provider !== 'manual' && existing.status === 'active') {
    const now = new Date();
    const hasTimeLeft = existing.currentPeriodEnd !== null && existing.currentPeriodEnd > now;
    const isShorteningDate =
      body.expiresAt !== undefined &&
      body.expiresAt !== null &&
      hasTimeLeft &&
      new Date(body.expiresAt) < (existing.currentPeriodEnd as Date);
    const isLoweringTier = TIER_ORDER.indexOf(body.tier) < TIER_ORDER.indexOf(existing.tier);

    if ((isShorteningDate || isLoweringTier) && !force) {
      return NextResponse.json(
        {
          error: 'Refusing to reduce a paid subscription',
          code: 'PAID_SUB_SHRINK_BLOCKED',
          detail: {
            provider: existing.provider,
            currentTier: existing.tier,
            currentPeriodEnd: existing.currentPeriodEnd,
            requestedTier: body.tier,
            requestedExpiresAt: body.expiresAt,
            advice:
              'If you really mean to do this (refund issued, user requested cancel, etc.), retry with ?force=1.',
          },
        },
        { status: 409 },
      );
    }
  }

  // Build the update set. Only touch `currentPeriodEnd` / `cancelAtPeriodEnd`
  // if the admin explicitly provided `expiresAt`. Otherwise leave them alone —
  // wiping them on every grant would clobber an active Stripe/LS subscription's
  // renewal date.
  const updateValues: Record<string, unknown> = {
    tier: body.tier,
    status: 'active',
    grantedBy: guard.user.id,
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

  // Audit metadata holds userId only, not email — preserves GDPR Art. 17
  // when target user later deletes their account.
  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: {
      kind: 'tier_grant',
      targetUserId: id,
      previousTier: existing?.tier ?? 'free',
      newTier: body.tier,
      notes: body.notes,
      expiresAt: body.expiresAt ?? null,
      forced: force,
    },
  });

  return NextResponse.json({ success: true, tier: body.tier });
}
