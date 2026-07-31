/**
 * PATCH /api/admin/moderation/trust-requests/[id] — approve or deny a
 * trustedSharerRequests row.
 *
 * approve -> sets featureFlags.trustedSharer=true on the requesting
 * user (merged, same pattern as /api/admin/users/[id]/flags — never
 * clobbers other flags) and marks the request 'approved'.
 * deny -> marks the request 'denied' only; no flag change (covers the
 * already-false default).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth-guards';
import { auditEvent } from '@/lib/audit';

const PatchBody = z.object({
  decision: z.enum(['approve', 'deny']),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const existing = await db.query.trustedSharerRequests.findFirst({
    where: eq(schema.trustedSharerRequests.id, id),
  });
  if (!existing || existing.status !== 'pending') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const nextStatus = body.decision === 'approve' ? 'approved' : 'denied';

  await db
    .update(schema.trustedSharerRequests)
    .set({ status: nextStatus, reviewedAt: new Date(), reviewedByUserId: guard.user.id })
    .where(eq(schema.trustedSharerRequests.id, id));

  if (body.decision === 'approve') {
    const target = await db.query.users.findFirst({
      where: eq(schema.users.id, existing.userId),
      columns: { featureFlags: true },
    });
    const merged = { ...(target?.featureFlags ?? {}), trustedSharer: true };
    await db
      .update(schema.users)
      .set({ featureFlags: merged })
      .where(eq(schema.users.id, existing.userId));
  }

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: {
      kind: 'trusted_sharer_request_reviewed',
      requestId: id,
      targetUserId: existing.userId,
      decision: body.decision,
    },
  });

  return NextResponse.json({ success: true });
}
