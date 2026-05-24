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
    return NextResponse.json({ error: 'Invalid body', detail: (err as Error).message }, { status: 400 });
  }

  const coupon = await db.query.coupons.findFirst({
    where: eq(schema.coupons.code, code.toUpperCase()),
  });
  if (!coupon) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates: Partial<typeof schema.coupons.$inferInsert> = {};
  if (body.discountPercent !== undefined) updates.discountPercent = body.discountPercent;
  if (body.expiresAt !== undefined) updates.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (body.usageLimit !== undefined) updates.usageLimit = body.usageLimit;
  if (body.notes !== undefined) updates.notes = body.notes;

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

  await db.delete(schema.coupons).where(eq(schema.coupons.code, code.toUpperCase()));

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'coupon_deleted', code },
  });

  return NextResponse.json({ success: true });
}
