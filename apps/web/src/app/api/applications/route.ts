/**
 * GET  /api/applications — list current user's tracked applications
 * POST /api/applications — start tracking a job (status defaults to 'interested')
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';

const APP_STATUSES = [
  'interested',
  'applied',
  'recruiter_screen',
  'tech_interview',
  'onsite',
  'offer',
  'rejected',
  'ghosted',
] as const;

export async function GET(): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  const rows = await db
    .select({
      id: schema.applications.id,
      jobId: schema.applications.jobId,
      jobTitle: schema.jobs.title,
      jobCompany: schema.jobs.company,
      jobUrl: schema.jobs.url,
      status: schema.applications.status,
      notes: schema.applications.notes,
      contactName: schema.applications.contactName,
      contactEmail: schema.applications.contactEmail,
      nextActionAt: schema.applications.nextActionAt,
      appliedAt: schema.applications.appliedAt,
      notifyRecruiter: schema.applications.notifyRecruiter,
      createdAt: schema.applications.createdAt,
      updatedAt: schema.applications.updatedAt,
    })
    .from(schema.applications)
    .innerJoin(schema.jobs, eq(schema.applications.jobId, schema.jobs.id))
    .where(eq(schema.applications.userId, guard.user.id))
    .orderBy(desc(schema.applications.updatedAt));

  return NextResponse.json({ applications: rows });
}

const PostBody = z.object({
  jobId: z.string().uuid(),
  status: z.enum(APP_STATUSES).default('interested'),
  notes: z.string().max(2000).optional(),
  notifyRecruiter: z.boolean().default(false),
});

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  // Verify job exists; refuse to create an application against a deleted job.
  const job = await db.query.jobs.findFirst({
    where: eq(schema.jobs.id, body.jobId),
    columns: { id: true },
  });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  // Refuse duplicate: a user can only have one application per job.
  const existing = await db.query.applications.findFirst({
    where: and(
      eq(schema.applications.userId, guard.user.id),
      eq(schema.applications.jobId, body.jobId),
    ),
    columns: { id: true },
  });
  if (existing) return NextResponse.json({ id: existing.id, deduped: true });

  const [row] = await db
    .insert(schema.applications)
    .values({
      userId: guard.user.id,
      jobId: body.jobId,
      status: body.status,
      ...(body.notes ? { notes: body.notes } : {}),
      notifyRecruiter: body.notifyRecruiter,
      ...(body.status === 'applied' ? { appliedAt: new Date() } : {}),
    })
    .returning({ id: schema.applications.id });

  return NextResponse.json({ id: row?.id, deduped: false });
}
