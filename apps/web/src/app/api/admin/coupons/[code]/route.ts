/**
 * GET    /api/admin/coupons/[code] — get single coupon with redemption count
 * PATCH  /api/admin/coupons/[code] — update coupon
 * DELETE /api/admin/coupons/[code] — delete coupon
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { eq, count } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth-guards';
import { env } from '@/lib/env';
import { logger } from '@/lib/observability';

const PatchSchema = z.object({
  discountPercent: z.number().int().min(1).max(100).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const { code } = await params;

  const coupon = await db.query.coupons.findFirst({
    where: eq(schema.coupons.code, code.toUpperCase()),
  });
  if (!coupon) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [redemptionCount] = await db
    .select({ count: count() })
    .from(schema.couponRedemptions)
    .where(eq(schema.couponRedemptions.couponId, coupon.id));

  return NextResponse.json({ coupon, redemptionCount: redemptionCount?.count ?? 0 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const { code } = await params;

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const coupon = await db.query.coupons.findFirst({
    where: eq(schema.coupons.code, code.toUpperCase()),
  });
  if (!coupon) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates: Partial<typeof schema.coupons.$inferInsert> = {};
  if (body.discountPercent !== undefined) updates.discountPercent = body.discountPercent;
  if (body.expiresAt !== undefined)
    updates.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (body.usageLimit !== undefined) updates.usageLimit = body.usageLimit;
  if (body.notes !== undefined) updates.notes = body.notes;

  // LemonSqueezy discounts are immutable — the API offers create/delete
  // but no update. So any field that's mirrored there has to be
  // re-created, or our row and the actual discount silently drift (admin
  // edits 10% → 20%, buyers keep getting 10%). `notes` alone is local.
  const affectsProvider =
    body.discountPercent !== undefined ||
    body.expiresAt !== undefined ||
    body.usageLimit !== undefined;

  if (affectsProvider && env.PAYMENT_PROVIDER === 'lemonsqueezy' && coupon.lsDiscountId) {
    const { createPercentDiscount, deletePercentDiscount } =
      await import('@/lib/billing/lemonsqueezy');
    try {
      // Delete first: LS rejects a second discount with the same code.
      await deletePercentDiscount(coupon.lsDiscountId);
    } catch (err) {
      logger.error({ err: (err as Error).message, code }, 'coupon.ls_update_delete_failed');
      return NextResponse.json(
        { error: 'Could not update the discount at the payment provider — nothing changed.' },
        { status: 502 },
      );
    }
    try {
      updates.lsDiscountId = await createPercentDiscount({
        name: (body.notes ?? coupon.notes)?.slice(0, 60) || `Resumaker ${coupon.code}`,
        code: coupon.code,
        percent: updates.discountPercent ?? coupon.discountPercent,
        expiresAt: updates.expiresAt !== undefined ? updates.expiresAt : coupon.expiresAt,
        maxRedemptions: updates.usageLimit !== undefined ? updates.usageLimit : coupon.usageLimit,
      });
    } catch (err) {
      // The old discount is already gone. Null the id and say so plainly
      // rather than leaving a row that looks live but discounts nothing.
      logger.error({ err: (err as Error).message, code }, 'coupon.ls_update_recreate_failed');
      await db
        .update(schema.coupons)
        .set({ ...updates, lsDiscountId: null })
        .where(eq(schema.coupons.code, code.toUpperCase()));
      return NextResponse.json(
        {
          error:
            'The provider discount was removed but could not be re-created. This coupon is now inactive — delete and re-create it.',
        },
        { status: 502 },
      );
    }
  }

  const [updated] = await db
    .update(schema.coupons)
    .set(updates)
    .where(eq(schema.coupons.code, code.toUpperCase()))
    .returning();

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'coupon_updated', code },
  });

  return NextResponse.json({ coupon: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const { code } = await params;

  const coupon = await db.query.coupons.findFirst({
    where: eq(schema.coupons.code, code.toUpperCase()),
  });
  if (!coupon) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Best-effort provider cleanup before dropping our row. If it fails we
  // still delete locally — an admin who can't remove a coupon from their
  // own panel is a worse outcome than a stale discount in LS, which is
  // visible and removable there.
  if (env.PAYMENT_PROVIDER === 'lemonsqueezy' && coupon.lsDiscountId) {
    try {
      const { deletePercentDiscount } = await import('@/lib/billing/lemonsqueezy');
      await deletePercentDiscount(coupon.lsDiscountId);
    } catch (err) {
      logger.error(
        { err: (err as Error).message, code, lsDiscountId: coupon.lsDiscountId },
        'coupon.ls_delete_failed',
      );
    }
  }

  await db.delete(schema.coupons).where(eq(schema.coupons.code, code.toUpperCase()));

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'coupon_deleted', code, lsDiscountId: coupon.lsDiscountId },
  });

  return NextResponse.json({ success: true });
}
