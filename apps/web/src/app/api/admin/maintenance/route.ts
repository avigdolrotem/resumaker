/**
 * GET  /api/admin/maintenance — get maintenance mode state
 * POST /api/admin/maintenance — update maintenance mode
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth-guards';

const UpdateSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(500).optional().nullable(),
  scheduledStart: z.string().datetime().optional().nullable(),
  scheduledEnd: z.string().datetime().optional().nullable(),
});

export async function GET(_req: NextRequest): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const row = await db.query.maintenanceMode.findFirst({
    where: eq(schema.maintenanceMode.id, 1),
  });

  return NextResponse.json({ state: row ?? { enabled: false } });
}

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  let body: z.infer<typeof UpdateSchema>;
  try {
    body = UpdateSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  await db
    .insert(schema.maintenanceMode)
    .values({
      id: 1,
      enabled: body.enabled,
      message: body.message ?? null,
      scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : null,
      scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : null,
      updatedAt: new Date(),
      updatedBy: guard.user.id,
    })
    .onConflictDoUpdate({
      target: schema.maintenanceMode.id,
      set: {
        enabled: body.enabled,
        message: body.message ?? null,
        scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : null,
        scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : null,
        updatedAt: new Date(),
        updatedBy: guard.user.id,
      },
    });

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'maintenance_mode_updated', enabled: body.enabled },
  });

  return NextResponse.json({ success: true, enabled: body.enabled });
}
