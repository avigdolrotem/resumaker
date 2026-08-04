/**
 * GET  /api/hr/jobs — list jobs THIS HR user has posted
 * POST /api/hr/jobs — post a new job (source='hr', hrUserId=caller)
 *
 * Only callers with role='hr' or role='admin'. Source-of-truth check
 * lives in the requireHr() helper.
 *
 * POST used to take a free-text `company` string with no link to the
 * companies table at all — companyId was never set on any HR-posted
 * job, which meant (a) /companies/[slug]'s "this company's open roles"
 * query, which filters on companyId, could never show a single result,
 * and (b) there was no way to know which companies row (and therefore
 * verified status) a posting belonged to. Now takes companyId, checks
 * membership the same way every other /api/hr/companies/[id] route
 * does, and derives the display name from the company row instead of
 * trusting free-typed input that could say anything.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';
import { requireHrRole } from '@/lib/hr-guards';
import { hrPlaceholderUrl } from '@/lib/hr-job-url';
import { auditEvent } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';

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
  companyId: z.string().uuid(),
  title: z.string().min(3).max(300),
  location: z.string().max(200).optional(),
  description: z.string().min(50).max(20_000),
  remote: z.boolean().default(false),
  seniority: z.string().max(50).optional(),
  applyUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireHr(await headers());
  if (guard instanceof NextResponse) return guard;

  // Bulk-import already rate-limits; the single-post path did not, so it
  // was the cheaper way to flood the shared feed.
  const rl = await checkRateLimit(`hr-job-post:${guard.user.id}`, 60, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterSeconds: rl.resetSeconds },
      { status: 429 },
    );
  }

  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  // Posting is a write, so 'viewer' (read-only by name) must not pass —
  // requireHrMember accepted every role including viewer.
  const memberCheck = await requireHrRole(body.companyId, guard.user.id, guard.user.role, [
    'owner',
    'recruiter',
  ]);
  if (memberCheck instanceof NextResponse) return memberCheck;

  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.id, body.companyId),
  });
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

  // Internal URL for HR-posted jobs: applicants click through to the
  // hosting page rather than an external posting (unless the HR provided
  // applyUrl). The URL normalization is deterministic per (user, time)
  // so dedupe works for accidental double-submits within the same second.
  const internalUrl = body.applyUrl ?? hrPlaceholderUrl(guard.user.id);
  const urlNorm = `${internalUrl.toLowerCase()}#${Date.now()}`;

  const [row] = await db
    .insert(schema.jobs)
    .values({
      externalId: null,
      source: 'hr',
      company: company.name,
      companySlug: company.slug,
      companyId: company.id,
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
