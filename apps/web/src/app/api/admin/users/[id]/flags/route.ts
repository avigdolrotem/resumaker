/**
 * PATCH /api/admin/users/[id]/flags — toggle per-user feature flags.
 *
 * Body: { jobHuntBeta?: boolean } (more flags can be added the same way)
 *
 * Merges into the existing users.feature_flags JSONB so partial updates
 * don't wipe other flags.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth-guards';

const BodySchema = z
  .object({
    jobHuntBeta: z.boolean().optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

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
    columns: { featureFlags: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Merge — preserve flags we didn't touch
  const merged = { ...(target.featureFlags ?? {}), ...body };

  await db
    .update(schema.users)
    .set({ featureFlags: merged, updatedAt: new Date() })
    .where(eq(schema.users.id, id));

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'feature_flag_update', targetUserId: id, changes: body },
  });

  return NextResponse.json({ success: true, flags: merged });
}
