/**
 * GET  /api/admin/coupons — list coupons
 * POST /api/admin/coupons — create coupon
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth-guards';
import { env } from '@/lib/env';
import { logger } from '@/lib/observability';
import { isUniqueViolation } from '@/lib/db-errors';

const CreateSchema = z.object({
  code: z.string().min(1).max(40).toUpperCase(),
  discountPercent: z.number().int().min(1).max(100),
  expiresAt: z.string().datetime().optional(),
  usageLimit: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

export async function GET(_req: NextRequest): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const rows = await db.query.coupons.findMany({
    orderBy: [desc(schema.coupons.createdAt)],
  });

  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  // Create the discount at the provider FIRST. If this fails we return
  // an error and write nothing — the previous behaviour was to insert a
  // row regardless, which is precisely how the coupon table filled up
  // with codes that discounted nothing.
  let lsDiscountId: string | null = null;
  if (env.PAYMENT_PROVIDER === 'lemonsqueezy') {
    try {
      const { createPercentDiscount } = await import('@/lib/billing/lemonsqueezy');
      lsDiscountId = await createPercentDiscount({
        name: body.notes?.slice(0, 60) || `Resumaker ${body.code}`,
        code: body.code,
        percent: body.discountPercent,
        expiresAt,
        maxRedemptions: body.usageLimit ?? null,
      });
    } catch (err) {
      logger.error({ err: (err as Error).message, code: body.code }, 'coupon.ls_create_failed');
      return NextResponse.json(
        {
          error: 'Could not create the discount at the payment provider — coupon not created.',
          detail: (err as Error).message,
        },
        { status: 502 },
      );
    }
  }

  let row;
  try {
    [row] = await db
      .insert(schema.coupons)
      .values({
        code: body.code,
        discountPercent: body.discountPercent,
        expiresAt,
        usageLimit: body.usageLimit ?? null,
        notes: body.notes ?? null,
        createdBy: guard.user.id,
        lsDiscountId,
      })
      .returning();
  } catch (err) {
    // Roll the provider side back so a duplicate code (or any insert
    // failure) doesn't strand an orphaned discount in LemonSqueezy that
    // nothing in the admin panel can see or remove.
    if (lsDiscountId) {
      try {
        const { deletePercentDiscount } = await import('@/lib/billing/lemonsqueezy');
        await deletePercentDiscount(lsDiscountId);
      } catch (cleanupErr) {
        logger.error(
          { err: (cleanupErr as Error).message, lsDiscountId },
          'coupon.ls_rollback_failed',
        );
      }
    }
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: 'That code already exists' }, { status: 409 });
    }
    throw err;
  }

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: {
      kind: 'coupon_created',
      code: body.code,
      discountPercent: body.discountPercent,
      lsDiscountId,
    },
  });

  return NextResponse.json({ row }, { status: 201 });
}
