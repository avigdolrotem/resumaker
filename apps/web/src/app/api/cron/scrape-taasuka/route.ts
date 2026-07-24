/**
 * GET /api/cron/scrape-taasuka
 *
 * Bearer-secret cron, run in-cluster by its own Helm CronJob (separate
 * from scrape-jobs — see infra/helm/resumaker/templates/
 * scrape-taasuka-cronjob.yaml) on a 15-minute cadence, much tighter than
 * the daily ATS/Comeet/Serper cron. It has to be: Taasuka
 * (taasuka.gov.il, Israel's national employment service) has ~16,700
 * listings across 37 occupation categories, paginated ~10/page — walking
 * all of it is a multi-thousand-page crawl that can't fit in one 5-minute
 * invocation, so this processes a bounded PAGES_PER_TICK window and
 * persists where it left off (categoryIndex + page) in the most recent
 * scrapeRuns row for source='taasuka', resuming from there next tick.
 * Reaching the end of the last category wraps back to the first —
 * there's no "done," just a continuous refresh cycle.
 *
 * Crawling per-category (not one flat crawl) means every job is
 * occupation-tagged at ingest time — job-engine's
 * TAASUKA_PROFESSION_CATEGORIES is the real category list from the
 * site's own filter form, confirmed to be plain GET params
 * (searchJobsForm uses method="get").
 *
 * Closure works differently here than the other sources' sweepClosures:
 * this crawler doesn't have discrete per-company "runs" that fully cover
 * a company's board the way Greenhouse/Lever/Workable/Ashby/Comeet do,
 * so "missed N consecutive runs" doesn't translate. A full cycle
 * (~1,670 pages) comfortably finishes well inside a day at this cadence
 * even accounting for slow ticks, so instead any Taasuka job whose
 * lastSeenAt is older than STALE_AFTER_DAYS (several cycles' worth of
 * margin) gets closed — a simple, cursor-free time threshold rather than
 * porting the miss-counting model to a source it doesn't fit.
 *
 * fetchTaasukaPage already excludes listings the site itself marks
 * inactive (its explicit status field), and already strips
 * phone/email-shaped substrings from descriptions before this route ever
 * sees them.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { logger } from '@/lib/observability';
import { verifyCronSecret } from '@/lib/cron-auth';
import { fetchTaasukaPage, TAASUKA_PROFESSION_CATEGORIES } from '@resumaker/job-engine';
import type { NormalizedJob } from '@resumaker/job-engine';

export const maxDuration = 300;

const PAGES_PER_TICK = 50;
const STALE_AFTER_DAYS = 3;
const UPSERT_CHUNK_SIZE = 500;
// Politeness: don't hammer a government server. ~1 req/s.
const DELAY_BETWEEN_PAGES_MS = 1000;

const CATEGORY_CODES = Object.keys(TAASUKA_PROFESSION_CATEGORIES);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface Cursor {
  categoryIndex: number;
  page: number;
}

/** Same upsert-by-(source,externalId) pattern as scrape-jobs/route.ts's upsertJobs. */
async function upsertTaasukaJobs(
  jobs: NormalizedJob[],
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const batch of chunk(jobs, UPSERT_CHUNK_SIZE)) {
    try {
      const rows = await db
        .insert(schema.jobs)
        .values(
          batch.map((item) => ({
            externalId: item.externalId,
            source: item.source,
            company: item.company,
            title: item.title,
            ...(item.location ? { location: item.location } : {}),
            description: item.description,
            url: item.url,
            urlNormalized: item.urlNormalized,
            remote: item.remote,
            ...(item.seniority ? { seniority: item.seniority } : {}),
            ...(item.postedAt ? { postedAt: item.postedAt } : {}),
            ...(item.rawData ? { rawData: item.rawData as Record<string, unknown> } : {}),
          })),
        )
        .onConflictDoUpdate({
          target: [schema.jobs.source, schema.jobs.externalId],
          targetWhere: sql`${schema.jobs.externalId} IS NOT NULL`,
          set: {
            title: sql`excluded.title`,
            location: sql`excluded.location`,
            description: sql`excluded.description`,
            url: sql`excluded.url`,
            urlNormalized: sql`excluded.url_normalized`,
            seniority: sql`excluded.seniority`,
            postedAt: sql`excluded.posted_at`,
            rawData: sql`excluded.raw_data`,
            lastSeenAt: sql`now()`,
            status: sql`'open'`,
            missCount: sql`0`,
          },
        })
        .returning({ inserted: sql<boolean>`(xmax = 0)` });

      inserted += rows.filter((r) => r.inserted).length;
      updated += rows.filter((r) => !r.inserted).length;
    } catch (err) {
      const msg = (err as Error).message;
      errors.push(`upsert:batch_of_${batch.length}:${msg}`);
      logger.warn({ err: msg, batchSize: batch.length }, 'cron.scrape_taasuka.upsert_failed');
    }
  }

  return { inserted, updated, errors };
}

export async function GET(req: NextRequest): Promise<Response> {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const tickStartedAt = Date.now();

  const lastRun = await db.query.scrapeRuns.findFirst({
    where: eq(schema.scrapeRuns.source, 'taasuka'),
    orderBy: [desc(schema.scrapeRuns.startedAt)],
  });
  const savedCursor = lastRun?.cursor as Cursor | null;
  let categoryIndex = savedCursor?.categoryIndex ?? 0;
  let page = savedCursor?.page ?? 1;

  let pagesProcessed = 0;
  let fetched = 0;
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];
  let cycleCompleted = false;

  while (pagesProcessed < PAGES_PER_TICK) {
    if (categoryIndex >= CATEGORY_CODES.length) {
      categoryIndex = 0;
      page = 1;
      cycleCompleted = true;
      break;
    }
    const categoryCode = CATEGORY_CODES[categoryIndex];
    if (!categoryCode) {
      categoryIndex++;
      continue;
    }

    if (pagesProcessed > 0) await sleep(DELAY_BETWEEN_PAGES_MS);
    const result = await fetchTaasukaPage(page, categoryCode);
    pagesProcessed++;

    if (!result.ok) {
      errors.push(`cat=${categoryCode} page=${page}: ${result.error}`);
      // Advance past it rather than get stuck retrying the same page
      // forever — a page that's broken this tick gets revisited on the
      // next full cycle regardless, since the crawl never "finishes."
      page++;
      continue;
    }

    fetched += result.jobs.length;
    if (result.jobs.length > 0) {
      const upsertResult = await upsertTaasukaJobs(result.jobs);
      inserted += upsertResult.inserted;
      updated += upsertResult.updated;
      errors.push(...upsertResult.errors);
    }

    const exhausted =
      result.jobs.length === 0 ||
      (result.totalResults !== undefined && page * 10 >= result.totalResults);
    if (exhausted) {
      categoryIndex++;
      page = 1;
    } else {
      page++;
    }
  }

  const cursor: Cursor = { categoryIndex, page };
  const stats = { pagesProcessed, fetched, inserted, updated, errors, cycleCompleted };
  const ok = errors.length === 0;

  await db.insert(schema.scrapeRuns).values({
    source: 'taasuka',
    startedAt: new Date(tickStartedAt),
    finishedAt: new Date(),
    cursor,
    stats,
    ok,
  });

  // Time-based closure — see the route doc comment for why this source
  // uses a staleness threshold instead of the other sources' miss-count
  // sweep. Cheap and idempotent; safe to run every tick.
  const staleRows = await db
    .update(schema.jobs)
    .set({
      status: 'closed',
      closedAt: sql`COALESCE(${schema.jobs.closedAt}, now())`,
    })
    .where(
      and(
        eq(schema.jobs.source, 'taasuka'),
        eq(schema.jobs.status, 'open'),
        sql`${schema.jobs.lastSeenAt} < now() - interval '1 day' * ${STALE_AFTER_DAYS}`,
      ),
    )
    .returning({ id: schema.jobs.id });

  const durationMs = Date.now() - tickStartedAt;
  const logFn = ok ? logger.info : logger.error;
  logFn.bind(logger)(
    { ...stats, cursor, staleClosed: staleRows.length, durationMs },
    'cron.scrape_taasuka.completed',
  );

  return NextResponse.json({
    success: ok,
    ...stats,
    cursor,
    staleClosed: staleRows.length,
    durationMs,
  });
}
