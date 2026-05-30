/**
 * GET /api/jobs — list jobs visible to the current user.
 *
 * Returns all `jobs` rows joined with this user's `user_jobs` state
 * (favorite + fit-score) when present. Filterable by:
 *   - q          (title/company substring, case-insensitive)
 *   - company    (exact slug)
 *   - source     (greenhouse/lever/...)
 *   - remote     (true/false)
 *   - favorite   (true → only this user's favorites)
 *
 * Pagination: cursor by `scrapedAt` desc (newest first), page size 20.
 *
 * L5 beta-gated.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { and, desc, eq, ilike, or, lt } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db, schema } from '@/db';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';

const PAGE_SIZE = 20;

export async function GET(req: NextRequest): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  const sp = req.nextUrl.searchParams;
  const q = sp.get('q')?.trim() ?? '';
  const company = sp.get('company')?.trim() ?? '';
  const source = sp.get('source')?.trim() ?? '';
  const remote = sp.get('remote');
  const favoriteOnly = sp.get('favorite') === 'true';
  const cursor = sp.get('cursor'); // ISO timestamp

  const conditions = [];
  if (q)
    conditions.push(or(ilike(schema.jobs.title, `%${q}%`), ilike(schema.jobs.company, `%${q}%`)));
  if (company) conditions.push(eq(schema.jobs.companySlug, company));
  if (source) conditions.push(eq(schema.jobs.source, source));
  if (remote === 'true') conditions.push(eq(schema.jobs.remote, true));
  if (remote === 'false') conditions.push(eq(schema.jobs.remote, false));
  if (cursor) conditions.push(lt(schema.jobs.scrapedAt, new Date(cursor)));

  const where = conditions.length ? and(...conditions) : undefined;

  // Left-join user_jobs so we can return favorite + fit-score in the same
  // row. The `favoriteOnly` filter requires an inner join — applied via
  // post-filter to keep the query shape consistent.
  const rows = await db
    .select({
      id: schema.jobs.id,
      source: schema.jobs.source,
      company: schema.jobs.company,
      companySlug: schema.jobs.companySlug,
      title: schema.jobs.title,
      location: schema.jobs.location,
      url: schema.jobs.url,
      remote: schema.jobs.remote,
      seniority: schema.jobs.seniority,
      postedAt: schema.jobs.postedAt,
      scrapedAt: schema.jobs.scrapedAt,
      isFavorite: schema.userJobs.isFavorite,
      fitScore: schema.userJobs.fitScore,
    })
    .from(schema.jobs)
    .leftJoin(
      schema.userJobs,
      and(eq(schema.userJobs.jobId, schema.jobs.id), eq(schema.userJobs.userId, guard.user.id)),
    )
    .where(where)
    .orderBy(desc(schema.jobs.scrapedAt))
    .limit(PAGE_SIZE + 1);

  const filtered = favoriteOnly ? rows.filter((r) => r.isFavorite === true) : rows;
  const hasMore = filtered.length > PAGE_SIZE;
  const page = filtered.slice(0, PAGE_SIZE);
  const nextCursor =
    hasMore && page.length > 0 ? page[page.length - 1]!.scrapedAt.toISOString() : null;

  return NextResponse.json({
    jobs: page,
    nextCursor,
    hasMore,
  });
}
