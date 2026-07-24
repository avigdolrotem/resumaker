/**
 * GET /api/jobs — list jobs visible to the current user.
 *
 * Returns all `jobs` rows joined with this user's `user_jobs` state
 * (favorite + fit-score) when present. Filterable by:
 *   - q            (full-text search over title+description, ranked)
 *   - company      (exact slug)
 *   - source       (greenhouse/lever/...)
 *   - remote       (true/false)
 *   - favorite     (true → only this user's favorites)
 *   - includeClosed (true → also return closed jobs; default excludes
 *                    them, since the point of a jobs feed is what's
 *                    currently open. Application-history views that
 *                    need a closed job to keep resolving should pass
 *                    this, or query by id directly, not rely on the
 *                    list default.)
 *
 * Always excludes canonicalJobId-set rows (cross-source duplicates —
 * see jobs.canonicalJobId's doc comment) so the same real-world job
 * found at two sources doesn't show up twice.
 *
 * Pagination: cursor by `scrapedAt` desc (newest first) when unfiltered
 * or `remote`/`source`/`company`-filtered; by rank desc when `q` is set
 * (full-text relevance, not recency, is what matters for a search).
 * Page size 20.
 *
 * L5 beta-gated.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
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
  const includeClosed = sp.get('includeClosed') === 'true';
  const cursor = sp.get('cursor'); // ISO timestamp, or a rank float string when q is set

  // websearch_to_tsquery tolerates arbitrary user input (quotes, bare
  // "-"/"|" characters, empty string) without throwing the syntax errors
  // plainto_tsquery/to_tsquery raise on malformed input — the right
  // choice for a value coming straight off the query string.
  const tsQuery = q ? sql`websearch_to_tsquery('simple', ${q})` : null;

  const conditions = [];
  if (tsQuery) conditions.push(sql`${schema.jobs.searchVector} @@ ${tsQuery}`);
  if (company) conditions.push(eq(schema.jobs.companySlug, company));
  if (source) conditions.push(eq(schema.jobs.source, source));
  if (remote === 'true') conditions.push(eq(schema.jobs.remote, true));
  if (remote === 'false') conditions.push(eq(schema.jobs.remote, false));
  if (!includeClosed) conditions.push(eq(schema.jobs.status, 'open'));
  conditions.push(isNull(schema.jobs.canonicalJobId));
  if (cursor) {
    if (tsQuery) {
      conditions.push(sql`ts_rank(${schema.jobs.searchVector}, ${tsQuery}) < ${Number(cursor)}`);
    } else {
      conditions.push(lt(schema.jobs.scrapedAt, new Date(cursor)));
    }
  }

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
      status: schema.jobs.status,
      postedAt: schema.jobs.postedAt,
      scrapedAt: schema.jobs.scrapedAt,
      isFavorite: schema.userJobs.isFavorite,
      fitScore: schema.userJobs.fitScore,
      ...(tsQuery ? { rank: sql<number>`ts_rank(${schema.jobs.searchVector}, ${tsQuery})` } : {}),
    })
    .from(schema.jobs)
    .leftJoin(
      schema.userJobs,
      and(eq(schema.userJobs.jobId, schema.jobs.id), eq(schema.userJobs.userId, guard.user.id)),
    )
    .where(where)
    .orderBy(
      tsQuery
        ? desc(sql`ts_rank(${schema.jobs.searchVector}, ${tsQuery})`)
        : desc(schema.jobs.scrapedAt),
    )
    .limit(PAGE_SIZE + 1);

  const filtered = favoriteOnly ? rows.filter((r) => r.isFavorite === true) : rows;
  const hasMore = filtered.length > PAGE_SIZE;
  const page = filtered.slice(0, PAGE_SIZE);
  const lastRow = page[page.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? tsQuery && 'rank' in lastRow
        ? String(lastRow.rank)
        : lastRow.scrapedAt.toISOString()
      : null;

  return NextResponse.json({
    jobs: page,
    nextCursor,
    hasMore,
  });
}
