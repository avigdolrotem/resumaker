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
    return NextResponse.json({ error: 'Invalid body', detail: (err as Error).message }, { status: 400 });
  }

  const [row] = await db
    .insert(schema.coupons)
    .values({
      code: body.code,
      discountPercent: body.discountPercent,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      usageLimit: body.usageLimit ?? null,
      notes: body.notes ?? null,
      createdBy: guard.user.id,
    })
    .returning();

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'coupon_created', code: body.code, discountPercent: body.discountPercent },
  });

  return NextResponse.json({ row }, { status: 201 });
}
