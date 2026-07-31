/**
 * PATCH /api/admin/moderation/jobs/[id] — approve or reject a pending
 * manual import (see lib/content-trust.ts for how a job lands here).
 *
 * approve -> status='open' (joins the shared feed).
 * reject  -> status='closed' (never deleted — same reasoning as every
 * other closure path in this app: applications.jobId/userJobs.jobId
 * cascade, and rejecting shouldn't be able to wipe someone else's
 * tracked-application history on a row that happens to share this id).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth-guards';
import { auditEvent } from '@/lib/audit';

const PatchBody = z.object({
  decision: z.enum(['approve', 'reject']),
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

  const existing = await db.query.jobs.findFirst({
    where: eq(schema.jobs.id, id),
    columns: { id: true, status: true, source: true },
  });
  if (!existing || existing.source !== 'manual' || existing.status !== 'pending') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const nextStatus = body.decision === 'approve' ? 'open' : 'closed';
  await db
    .update(schema.jobs)
    .set({ status: nextStatus, ...(nextStatus === 'closed' ? { closedAt: new Date() } : {}) })
    .where(eq(schema.jobs.id, id));

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'manual_import_moderated', jobId: id, decision: body.decision },
  });

  return NextResponse.json({ success: true });
}
