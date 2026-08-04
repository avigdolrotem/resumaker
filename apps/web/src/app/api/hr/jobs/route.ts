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

import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';
import { requireHrRole } from '@/lib/hr-guards';
import { hrPlaceholderUrl } from '@/lib/hr-job-url';
import { isUniqueViolation } from '@/lib/db-errors';
import { normalizeUrl } from '@resumaker/job-engine';
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

  // Same company, same title, still open — almost certainly a double
  // submit or a re-post of something already live. Checked explicitly
  // because the unique index on url_normalized cannot see it: a posting
  // with no external apply URL has only a synthetic URL, which is unique
  // per job by construction and therefore never collides.
  //
  // Scoped to OPEN listings on purpose. Re-posting a role that was filled
  // and closed months ago is a normal thing to do, and blocking it would
  // be worse than the duplicate.
  const duplicate = await db.query.jobs.findFirst({
    where: and(
      eq(schema.jobs.companyId, company.id),
      eq(schema.jobs.status, 'open'),
      sql`lower(${schema.jobs.title}) = lower(${body.title.trim()})`,
    ),
    columns: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      {
        error:
          'You already have an open listing with this title at this company. Edit or close it instead of posting a second one.',
        code: 'DUPLICATE_LISTING',
        existingJobId: duplicate.id,
      },
      { status: 409 },
    );
  }

  // Generate the id up front so the placeholder URL can reference the row
  // it belongs to. `jobs.url` is NOT NULL and applicants click through to
  // the hosting page unless the recruiter supplied a real applyUrl.
  const jobId = randomUUID();
  const internalUrl = body.applyUrl ?? hrPlaceholderUrl(jobId);
  // No `#${Date.now()}` suffix. That made every row unique and quietly
  // disabled the unique index — two posts sharing one real apply URL are
  // the same opening, and should collide.
  const urlNorm = normalizeUrl(internalUrl);

  // The unique index on url_normalized is the real duplicate guard for
  // postings that carry an external apply URL, including across
  // companies — the same Greenhouse link posted twice is one opening.
  // Catch the violation rather than letting it surface as a 500.
  let row: { id: string } | undefined;
  try {
    [row] = await db
      .insert(schema.jobs)
      .values({
        id: jobId,
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
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        {
          error:
            'A listing with this apply URL already exists. Edit the existing one instead of posting it again.',
          code: 'DUPLICATE_LISTING',
        },
        { status: 409 },
      );
    }
    throw err;
  }

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'hr_job_posted', jobId: row?.id, title: body.title },
  });

  return NextResponse.json({ id: row?.id });
}
