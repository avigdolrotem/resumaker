/**
 * GET /api/hr/jobs/[id]/applicants
 *
 * Returns applicants for an HR-posted job where notifyRecruiter=true.
 * Only the job-owning HR user (or admin/company member) can access.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { id } = await params;

  // Verify this job belongs to the caller (or admin)
  const job = await db.query.jobs.findFirst({
    where: and(eq(schema.jobs.id, id), eq(schema.jobs.source, 'hr')),
  });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (guard.user.role !== 'admin' && job.hrUserId !== guard.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const applicants = await db
    .select({
      applicationId: schema.applications.id,
      status: schema.applications.status,
      appliedAt: schema.applications.appliedAt,
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.applications)
    .innerJoin(schema.users, eq(schema.applications.userId, schema.users.id))
    .where(and(eq(schema.applications.jobId, id), eq(schema.applications.notifyRecruiter, true)));

  return NextResponse.json({ applicants });
}
