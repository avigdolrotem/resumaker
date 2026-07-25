/**
 * Shared jobs-list query — used by both GET /api/jobs (client-side
 * "Load more" pagination) and /jobs's initial server-rendered page, so
 * the two can never drift into different filter/sort/pagination
 * behavior. The page used to run its own bespoke 20-row query with no
 * cursor at all; this is the one place that logic now lives.
 *
 * Pagination: cursor by `scrapedAt` desc (newest first) when unfiltered
 * or `remote`/`source`/`company`-filtered; by rank desc when `q` is set
 * (full-text relevance, not recency, is what matters for a search).
 */
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { db, schema } from '@/db';

const PAGE_SIZE = 20;

export interface ListJobsParams {
  userId: string;
  q?: string;
  company?: string;
  source?: string;
  remote?: boolean;
  favoriteOnly?: boolean;
  includeClosed?: boolean;
  /** ISO timestamp, or a rank float string when `q` is set. */
  cursor?: string;
}

export interface JobListRow {
  id: string;
  source: string;
  company: string;
  companySlug: string | null;
  title: string;
  location: string | null;
  /** Truncated to ~300 chars at the SQL level — a card preview only ever
   * shows 2 lines (line-clamp-2 handles the ellipsis), no need to ship
   * a full multi-KB description just to render that. The detail page
   * queries the untruncated column directly. */
  descriptionPreview: string;
  url: string;
  remote: boolean;
  seniority: string | null;
  status: string;
  postedAt: Date | null;
  scrapedAt: Date;
  isFavorite: boolean | null;
  fitScore: number | null;
  rank?: number;
}

export interface ListJobsResult {
  jobs: JobListRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function listJobs(params: ListJobsParams): Promise<ListJobsResult> {
  const q = params.q?.trim() ?? '';

  // websearch_to_tsquery tolerates arbitrary user input (quotes, bare
  // "-"/"|" characters, empty string) without throwing the syntax errors
  // plainto_tsquery/to_tsquery raise on malformed input.
  const tsQuery = q ? sql`websearch_to_tsquery('simple', ${q})` : null;

  const conditions = [];
  if (tsQuery) conditions.push(sql`${schema.jobs.searchVector} @@ ${tsQuery}`);
  if (params.company) conditions.push(eq(schema.jobs.companySlug, params.company));
  if (params.source) conditions.push(eq(schema.jobs.source, params.source));
  if (params.remote !== undefined) conditions.push(eq(schema.jobs.remote, params.remote));
  if (!params.includeClosed) conditions.push(eq(schema.jobs.status, 'open'));
  conditions.push(isNull(schema.jobs.canonicalJobId));
  if (params.cursor) {
    if (tsQuery) {
      conditions.push(
        sql`ts_rank(${schema.jobs.searchVector}, ${tsQuery}) < ${Number(params.cursor)}`,
      );
    } else {
      conditions.push(lt(schema.jobs.scrapedAt, new Date(params.cursor)));
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
      descriptionPreview: sql<string>`left(${schema.jobs.description}, 300)`,
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
      and(eq(schema.userJobs.jobId, schema.jobs.id), eq(schema.userJobs.userId, params.userId)),
    )
    .where(where)
    .orderBy(
      tsQuery
        ? desc(sql`ts_rank(${schema.jobs.searchVector}, ${tsQuery})`)
        : desc(schema.jobs.scrapedAt),
    )
    .limit(PAGE_SIZE + 1);

  const filtered = params.favoriteOnly ? rows.filter((r) => r.isFavorite === true) : rows;
  const hasMore = filtered.length > PAGE_SIZE;
  const page = filtered.slice(0, PAGE_SIZE);
  const lastRow = page[page.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? tsQuery && 'rank' in lastRow
        ? String(lastRow.rank)
        : lastRow.scrapedAt.toISOString()
      : null;

  return { jobs: page, nextCursor, hasMore };
}
