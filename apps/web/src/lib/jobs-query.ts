/**
 * Shared jobs-list query — used by both GET /api/jobs (client-side page
 * navigation) and /jobs's initial server-rendered page, so the two can
 * never drift into different filter/sort/pagination behavior.
 *
 * Pagination: real pages (page=1,2,3…), not cursor-based "load more" —
 * offset/limit is entirely adequate at this table's size (tens of
 * thousands of rows, not the point where OFFSET's O(n) skip cost
 * actually matters) and lets the UI show Prev/Next + a page count
 * instead of an ever-growing single list.
 */
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { db, schema } from '@/db';

// Multiple of 3 so the 3-column grid (jobs-list.tsx) never ends a page
// on a partial row — 20 left a dangling 2-card row every time.
export const PAGE_SIZE = 21;

export interface ListJobsParams {
  userId: string;
  q?: string;
  company?: string;
  source?: string;
  remote?: boolean;
  favoriteOnly?: boolean;
  includeClosed?: boolean;
  israeliOnly?: boolean;
  /** 1-indexed. Defaults to 1. */
  page?: number;
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
}

export interface ListJobsResult {
  jobs: JobListRow[];
  page: number;
  totalPages: number;
  totalCount: number;
}

/**
 * Matches location strings that read as Israel-based. Deliberately a
 * plain string match, not an LLM call — location is already a clean
 * structured field from every source (verified: "Israel - Tel Aviv",
 * "United Kingdom - London" etc. straight from Greenhouse's own API),
 * so this is a lookup problem, not a judgment one. Taasuka locations
 * are Hebrew city names with no country suffix at all (it's an
 * Israeli-government board, every listing already is Israeli) — NULL
 * location + source='taasuka' also counts as Israeli for that reason.
 */
export const ISRAELI_LOCATION_RE =
  /israel|תל.?אביב|תל אביב|ירושלים|חיפה|באר.?שבע|רמת.?גן|הרצליה|פתח.?תקווה|נתניה|רעננה|כפר.?סבא|ראשון.?לציון|רחובות|אשדוד|אשקלון|נצרת|יפו/i;

export function isIsraeliLocation(location: string | null, source: string): boolean {
  if (source === 'taasuka' || source === 'hr') return true; // Israeli by construction
  if (!location) return false;
  return ISRAELI_LOCATION_RE.test(location);
}

export async function listJobs(params: ListJobsParams): Promise<ListJobsResult> {
  const q = params.q?.trim() ?? '';
  const page = Math.max(1, params.page ?? 1);

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
  if (params.israeliOnly) {
    // Same plain-text rule as isIsraeliLocation, expressed in SQL so it
    // can filter + paginate server-side instead of over-fetching and
    // filtering in JS (which would break page counts/limits).
    conditions.push(
      sql`(${schema.jobs.source} IN ('taasuka', 'hr') OR ${schema.jobs.location} ~* ${ISRAELI_LOCATION_RE.source})`,
    );
  }
  conditions.push(isNull(schema.jobs.canonicalJobId));

  const where = conditions.length ? and(...conditions) : undefined;

  // Left-join user_jobs so we can return favorite + fit-score in the same
  // row. The `favoriteOnly` filter requires an inner join — applied via
  // post-filter (small enough result sets per page that this is fine;
  // see the comment below on why it doesn't affect the page count).
  const baseQuery = db
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
    );

  // favoriteOnly can't be expressed as a WHERE (it depends on the
  // left-joined row), so it's not reflected in the COUNT below — a rare
  // filter combo (favorites are typically a handful), and worst case
  // means a page shows fewer than PAGE_SIZE favorited rows rather than
  // a wrong total. Not worth a second, differently-shaped query for.
  const [countRow] = await db.select({ value: count() }).from(schema.jobs).where(where);
  const totalCount = countRow?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);

  const rows = await baseQuery.limit(PAGE_SIZE).offset((clampedPage - 1) * PAGE_SIZE);
  const jobs = params.favoriteOnly ? rows.filter((r) => r.isFavorite === true) : rows;

  return { jobs, page: clampedPage, totalPages, totalCount };
}
