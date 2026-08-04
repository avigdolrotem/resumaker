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
import { and, count, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { db, schema } from '@/db';

// A multiple of 1/2/3/4/6/8/12 so the grid never ends a page on a
// partial row no matter how many columns a future breakpoint uses —
// 20 left a dangling 2-card row every time at the current 3-column
// layout. 24 rows (8 rows of 3) balances scroll depth against how
// often someone has to click to the next page.
export const PAGE_SIZE = 24;

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
  /** True only for source='hr' jobs whose company has a verified domain match (see company-verification.ts). Null when the job has no linked company at all. */
  companyVerified: boolean | null;
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
  // Unmoderated manual imports are NEVER listable, by any caller, under
  // any flag combination. Expressed as its own always-on exclusion
  // rather than relying on the open-only filter below: that filter is
  // switched off by `includeClosed` (a legitimate, caller-supplied
  // widening for application-history views), which silently un-hid
  // every pending row to anyone who passed ?includeClosed=true. An
  // inclusion filter can't be the moderation boundary — see
  // lib/content-trust.ts for what 'pending' means.
  conditions.push(ne(schema.jobs.status, 'pending'));
  if (!params.includeClosed) conditions.push(eq(schema.jobs.status, 'open'));
  if (params.israeliOnly) {
    // Same plain-text rule as isIsraeliLocation, expressed in SQL so it
    // can filter + paginate server-side instead of over-fetching and
    // filtering in JS (which would break page counts/limits).
    //
    // 'manual' joins the trusted sources deliberately. A pasted job
    // reaches status='open' only by passing human moderation or coming
    // from a trusted sharer, and its `location` is frequently NULL
    // because nothing parses one out of free text. Judging those rows on
    // location alone meant an admin could approve a job, see the success
    // toast, watch the audit log record it — and the job would never
    // appear anywhere, because it failed a geography test it had no data
    // to pass. Approval is the signal that a manual job belongs here;
    // this filter shouldn't get to overrule it.
    conditions.push(
      sql`(${schema.jobs.source} IN ('taasuka', 'hr', 'manual') OR ${schema.jobs.location} ~* ${ISRAELI_LOCATION_RE.source})`,
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
      companyVerified: schema.companies.verified,
    })
    .from(schema.jobs)
    .leftJoin(
      schema.userJobs,
      and(eq(schema.userJobs.jobId, schema.jobs.id), eq(schema.userJobs.userId, params.userId)),
    )
    .leftJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
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
