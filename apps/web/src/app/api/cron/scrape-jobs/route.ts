/**
 * GET /api/cron/scrape-jobs
 *
 * Bearer-secret cron, run in-cluster by the scrape-jobs Helm CronJob
 * (infra/helm/resumaker/templates/scrape-jobs-cronjob.yaml) — that
 * manifest curls this route with the CRON_SECRET, so GET (not POST) is
 * what actually gets exercised; keep it GET.
 *
 * Hits every wired scraper source (Greenhouse, Lever, Workable, Ashby,
 * Comeet) for its curated Israeli company list (job-engine's COMPANIES /
 * COMEET_COMPANIES) and upserts by (source, external_id) — a re-scrape of
 * a still-open job refreshes its content and bumps lastSeenAt/resets
 * missCount/status instead of just being silently deduped.
 *
 * Also runs the closure sweep: for each source, any job belonging to a
 * company we *successfully* checked this run but that didn't come back
 * in the fetch gets missCount+1, closing at CLOSE_AFTER_MISSES misses.
 * Scoped to companies that were actually fetched OK this run — a company
 * whose fetch itself failed contributes no closure signal at all (see
 * FetchResult's doc comment), and a company dropped from the curated list
 * entirely is out of scope for every future sweep, not just this one; its
 * jobs go stale rather than wrongly closing.
 *
 * The job-engine package handles the actual HTTP + parsing. Each
 * source's fetcher returns FetchResult — {ok:false} on a genuine fetch
 * failure vs {ok:true, jobs:[]} for "this company's board is just
 * empty right now" — so a transient network blip on one company can't
 * get misread as "every job at that company closed."
 */

import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { logger } from '@/lib/observability';
import { verifyCronSecret } from '@/lib/cron-auth';
import type { ComeetCompany, FetchResult, NormalizedJob } from '@resumaker/job-engine';

export const maxDuration = 300; // 5 minutes — scraping can take a while

const UPSERT_CHUNK_SIZE = 500;
// Consecutive full sweeps a previously-seen job can be absent from a
// successful fetch before it's considered closed rather than a transient
// scrape hiccup (a company board flickering empty for one run, etc.).
const CLOSE_AFTER_MISSES = 2;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface SourceStats {
  companies: number;
  fetchErrors: string[];
  fetched: number;
  inserted: number;
  updated: number;
  insertErrors: string[];
  missIncremented: number;
  closed: number;
}

/** Upsert one source's collected jobs, batched. Returns {inserted, updated} counts. */
async function upsertJobs(
  jobs: NormalizedJob[],
  source: string,
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
            ...(item.companySlug ? { companySlug: item.companySlug } : {}),
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
          // Matches the partial unique index (external_id IS NOT NULL) —
          // without this, Postgres can't infer which constraint the
          // conflict target refers to and the upsert throws.
          targetWhere: sql`${schema.jobs.externalId} IS NOT NULL`,
          set: {
            title: sql`excluded.title`,
            company: sql`excluded.company`,
            companySlug: sql`excluded.company_slug`,
            location: sql`excluded.location`,
            description: sql`excluded.description`,
            url: sql`excluded.url`,
            urlNormalized: sql`excluded.url_normalized`,
            remote: sql`excluded.remote`,
            seniority: sql`excluded.seniority`,
            postedAt: sql`excluded.posted_at`,
            rawData: sql`excluded.raw_data`,
            lastSeenAt: sql`now()`,
            // A job re-appearing after being marked closed/unknown is a
            // real "it's back" signal, not just a refresh — reopen it.
            status: sql`'open'`,
            missCount: sql`0`,
          },
        })
        // xmax = 0 is the standard Postgres tell for "this row was just
        // inserted, not updated" within the same statement — the UPDATE
        // arm of an upsert always leaves a non-zero xmax.
        .returning({ inserted: sql<boolean>`(xmax = 0)` });

      inserted += rows.filter((r) => r.inserted).length;
      updated += rows.filter((r) => !r.inserted).length;
    } catch (err) {
      const msg = (err as Error).message;
      errors.push(`upsert:${source}:batch_of_${batch.length}:${msg}`);
      logger.warn({ err: msg, source, batchSize: batch.length }, 'cron.scrape_jobs.upsert_failed');
    }
  }

  return { inserted, updated, errors };
}

/**
 * Mark jobs stale for companies we successfully checked this run but that
 * didn't reappear in the fetch. `checkedSlugs` must only include companies
 * whose fetch succeeded this run (a failed fetch is not a closure signal —
 * see the route doc comment). Returns early (no-op) if nothing succeeded,
 * since there's no scope to sweep against.
 */
async function sweepClosures(
  source: string,
  checkedSlugs: string[],
  seenExternalIds: string[],
): Promise<{ missIncremented: number; closed: number }> {
  if (checkedSlugs.length === 0) return { missIncremented: 0, closed: 0 };

  const conditions = [
    eq(schema.jobs.source, source),
    inArray(schema.jobs.companySlug, checkedSlugs),
    eq(schema.jobs.status, 'open'),
  ];
  // Omit rather than pass [] to notInArray — "not in the empty set" should
  // mean "matches everything" (a company confirmed to have zero current
  // listings correctly closes every job we'd previously seen from it),
  // and relying on notInArray's own empty-array SQL generation for that
  // is one more thing to get subtly wrong.
  if (seenExternalIds.length > 0) {
    conditions.push(notInArray(schema.jobs.externalId, seenExternalIds));
  }

  const rows = await db
    .update(schema.jobs)
    .set({
      missCount: sql`${schema.jobs.missCount} + 1`,
      status: sql`CASE WHEN ${schema.jobs.missCount} + 1 >= ${CLOSE_AFTER_MISSES} THEN 'closed' ELSE ${schema.jobs.status} END`,
      closedAt: sql`CASE WHEN ${schema.jobs.missCount} + 1 >= ${CLOSE_AFTER_MISSES} THEN COALESCE(${schema.jobs.closedAt}, now()) ELSE ${schema.jobs.closedAt} END`,
    })
    .where(and(...conditions))
    .returning({ status: schema.jobs.status });

  const closed = rows.filter((r) => r.status === 'closed').length;
  return { missIncremented: rows.length, closed };
}

/**
 * Shared tail end for every source: upsert what was fetched, sweep
 * closures for the companies that succeeded, log a scrapeRuns row.
 * Mutates and returns `stats` for the caller to fold into perSource.
 */
async function finishSource(
  source: string,
  sourceStartedAt: number,
  companiesAttempted: number,
  fetchErrors: string[],
  checkedSlugs: string[],
  collected: NormalizedJob[],
): Promise<SourceStats> {
  const { inserted, updated, errors: insertErrors } = await upsertJobs(collected, source);
  const { missIncremented, closed } = await sweepClosures(
    source,
    checkedSlugs,
    collected.map((j) => j.externalId),
  );

  const stats: SourceStats = {
    companies: companiesAttempted,
    fetchErrors,
    fetched: collected.length,
    inserted,
    updated,
    insertErrors,
    missIncremented,
    closed,
  };

  const ok = fetchErrors.length === 0 && insertErrors.length === 0;
  await db.insert(schema.scrapeRuns).values({
    source,
    startedAt: new Date(sourceStartedAt),
    finishedAt: new Date(),
    stats,
    ok,
  });

  return stats;
}

export async function GET(req: NextRequest): Promise<Response> {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const invocationStartedAt = Date.now();

  let companies: Record<string, string[]> = {};
  let comeetCompanies: ComeetCompany[] = [];
  let fetchers: Record<string, (slug: string) => Promise<FetchResult>>;
  let fetchComeet: (slug: string, uid: string, token: string) => Promise<FetchResult>;
  try {
    const engine = await import('@resumaker/job-engine');
    companies = (engine as unknown as { COMPANIES: Record<string, string[]> }).COMPANIES;
    comeetCompanies = engine.COMEET_COMPANIES;
    fetchComeet = engine.fetchComeetJobs;
    fetchers = {
      greenhouse: engine.fetchGreenhouseJobs,
      lever: engine.fetchLeverJobs,
      workable: engine.fetchWorkableJobs,
      ashby: engine.fetchAshbyJobs,
    };
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'cron.scrape_jobs.engine_load_failed');
    return NextResponse.json(
      { error: 'job-engine unavailable', detail: (err as Error).message },
      { status: 503 },
    );
  }

  const perSource: Record<string, SourceStats> = {};

  for (const [source, fetchFn] of Object.entries(fetchers)) {
    const slugs = companies[source] ?? [];
    const sourceStartedAt = Date.now();
    const fetchErrors: string[] = [];
    const checkedSlugs: string[] = [];
    const collected: NormalizedJob[] = [];

    for (const slug of slugs) {
      let result: FetchResult;
      try {
        result = await fetchFn(slug);
      } catch (err) {
        fetchErrors.push(`${slug}:${(err as Error).message}`);
        continue;
      }
      if (!result.ok) {
        fetchErrors.push(`${slug}:${result.error}`);
        continue;
      }
      checkedSlugs.push(slug);
      collected.push(...result.jobs);
    }

    perSource[source] = await finishSource(
      source,
      sourceStartedAt,
      slugs.length,
      fetchErrors,
      checkedSlugs,
      collected,
    );
  }

  // Comeet needs a slug+uid+token triple per company, not a bare slug, so
  // it can't share the generic loop above.
  {
    const source = 'comeet';
    const sourceStartedAt = Date.now();
    const fetchErrors: string[] = [];
    const checkedSlugs: string[] = [];
    const collected: NormalizedJob[] = [];

    for (const company of comeetCompanies) {
      let result: FetchResult;
      try {
        result = await fetchComeet(company.slug, company.uid, company.token);
      } catch (err) {
        fetchErrors.push(`${company.slug}:${(err as Error).message}`);
        continue;
      }
      if (!result.ok) {
        // A 401 here means the token's rotated — see harvestComeetToken's
        // doc comment for the re-harvest path. Surfaces as a normal fetch
        // error, not a crash.
        fetchErrors.push(`${company.slug}:${result.error}`);
        continue;
      }
      checkedSlugs.push(company.slug);
      collected.push(...result.jobs);
    }

    perSource[source] = await finishSource(
      source,
      sourceStartedAt,
      comeetCompanies.length,
      fetchErrors,
      checkedSlugs,
      collected,
    );
  }

  const durationMs = Date.now() - invocationStartedAt;
  const allErrors = Object.values(perSource).flatMap((s) => [...s.fetchErrors, ...s.insertErrors]);
  const success = allErrors.length === 0;
  // Use error level if any failures so Vercel cron dashboard surfaces it.
  const logFn = success ? logger.info : logger.error;
  logFn.bind(logger)({ perSource, durationMs, success }, 'cron.scrape_jobs.completed');

  return NextResponse.json({ success, perSource, durationMs });
}
