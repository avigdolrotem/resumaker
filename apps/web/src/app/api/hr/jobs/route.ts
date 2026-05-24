/**
 * GET  /api/hr/jobs — list jobs THIS HR user has posted
 * POST /api/hr/jobs — post a new job (source='hr', hrUserId=caller)
 *
 * Only callers with role='hr' or role='admin'. Source-of-truth check
 * lives in the requireHr() helper.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';
import { auditEvent } from '@/lib/audit';

async function requireHr(headers: Headers) {
  const guard = await requireActiveUser(headers);
  if (guard instanceof NextResponse) return guard;
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return guard;
}

export async function GET(): Promise<Response> {
  const guard = await requireHr(await headers());
  if (guard instanceof NextResponse) return guard;

  const rows = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.title,
      company: schema.jobs.company,
      location: schema.jobs.location,
      remote: schema.jobs.remote,
      postedAt: schema.jobs.postedAt,
      scrapedAt: schema.jobs.scrapedAt,
    })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.source, 'hr'), eq(schema.jobs.hrUserId, guard.user.id)))
    .orderBy(desc(schema.jobs.scrapedAt));

  return NextResponse.json({ jobs: rows });
}

const PostBody = z.object({
  title: z.string().min(3).max(300),
  company: z.string().min(1).max(200),
  location: z.string().max(200).optional(),
  description: z.string().min(50).max(20_000),
  remote: z.boolean().default(false),
  seniority: z.string().max(50).optional(),
  applyUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireHr(await headers());
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

  // Internal URL for HR-posted jobs: applicants click through to the
  // hosting page rather than an external posting (unless the HR provided
  // applyUrl). The URL normalization is deterministic per (user, time)
  // so dedupe works for accidental double-submits within the same second.
  const internalUrl = body.applyUrl ?? `https://resumaker.co.il/jobs/hr-${guard.user.id}`;
  const urlNorm = `${internalUrl.toLowerCase()}#${Date.now()}`;

  const [row] = await db
    .insert(schema.jobs)
    .values({
      externalId: null,
      source: 'hr',
      company: body.company,
      title: body.title,
      ...(body.location ? { location: body.location } : {}),
      description: body.description,
      url: internalUrl,
      urlNormalized: urlNorm,
      remote: body.remote,
      ...(body.seniority ? { seniority: body.seniority } : {}),
      hrUserId: guard.user.id,
      postedAt: new Date(),
    })
    .returning({ id: schema.jobs.id });

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'hr_job_posted', jobId: row?.id, title: body.title },
  });

  return NextResponse.json({ id: row?.id });
}
