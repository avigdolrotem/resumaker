/**
 * PATCH  /api/hr/jobs/[id] — edit own HR-posted job, including status
 *        (open/closed — the "mark this filled" action)
 * DELETE /api/hr/jobs/[id] — close own HR-posted job
 *
 * DELETE does NOT delete the row — it sets status='closed', same as
 * PATCH {status:'closed'}. The jobs table's own schema comment is
 * explicit about why: applications.jobId and userJobs.jobId both
 * cascade on a real delete, so removing a job row would silently wipe
 * every applicant's tracked-application history for it. Kept as the
 * DELETE verb (not merged into PATCH-only) because "remove this
 * listing" is the client-facing action an HR user actually takes —
 * it just isn't destructive underneath.
 *
 * Only the owning HR user (or admin) can mutate. Other HR users
 * see 404 (not 403, to hide existence).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';
import { auditEvent } from '@/lib/audit';

const Patch = z.object({
  title: z.string().min(3).max(300).optional(),
  company: z.string().min(1).max(200).optional(),
  location: z.string().max(200).optional(),
  description: z.string().min(50).max(20_000).optional(),
  remote: z.boolean().optional(),
  seniority: z.string().max(50).optional(),
  status: z.enum(['open', 'closed']).optional(),
});

async function getOwned(id: string, hrUserId: string, role: string) {
  return db.query.jobs.findFirst({
    where: and(
      eq(schema.jobs.id, id),
      eq(schema.jobs.source, 'hr'),
      role === 'admin' ? undefined : eq(schema.jobs.hrUserId, hrUserId),
    ),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { id } = await params;
  const existing = await getOwned(id, guard.user.id, guard.user.role);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: z.infer<typeof Patch>;
  try {
    body = Patch.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates['title'] = body.title;
  if (body.company !== undefined) updates['company'] = body.company;
  if (body.location !== undefined) updates['location'] = body.location;
  if (body.description !== undefined) updates['description'] = body.description;
  if (body.remote !== undefined) updates['remote'] = body.remote;
  if (body.seniority !== undefined) updates['seniority'] = body.seniority;
  if (body.status !== undefined) {
    updates['status'] = body.status;
    updates['closedAt'] = body.status === 'closed' ? new Date() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  await db.update(schema.jobs).set(updates).where(eq(schema.jobs.id, id));

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'hr_job_edited', jobId: id, fields: Object.keys(updates) },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { id } = await params;
  const existing = await getOwned(id, guard.user.id, guard.user.role);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db
    .update(schema.jobs)
    .set({ status: 'closed', closedAt: new Date() })
    .where(eq(schema.jobs.id, id));

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'hr_job_closed', jobId: id },
  });

  return NextResponse.json({ success: true });
}
