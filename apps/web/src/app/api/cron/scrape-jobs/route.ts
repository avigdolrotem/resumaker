/**
 * GET /api/cron/scrape-jobs
 *
 * Bearer-secret cron, run in-cluster by the scrape-jobs Helm CronJob
 * (infra/helm/resumaker/templates/scrape-jobs-cronjob.yaml) — that
 * manifest curls this route with the CRON_SECRET, so GET (not POST) is
 * what actually gets exercised; keep it GET.
 *
 * Hits every wired scraper source (Greenhouse, Lever, Workable, Ashby)
 * for its curated Israeli company list (job-engine's COMPANIES) and
 * upserts by (source, external_id) — a re-scrape of a still-open job
 * refreshes its content and bumps lastSeenAt/resets missCount/status
 * instead of just being silently deduped, which is what actually makes
 * "is this job still open" trackable over time (see the closure sweep
 * planned for Phase 1, which increments missCount on jobs that stop
 * showing up in a source's successful fetches).
 *
 * The job-engine package handles the actual HTTP + parsing. Each
 * source's fetcher returns FetchResult — {ok:false} on a genuine fetch
 * failure vs {ok:true, jobs:[]} for "this company's board is just
 * empty right now" — so a transient network blip on one company can't
 * get misread as "every job at that company closed."
 */

import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { logger } from '@/lib/observability';
import { verifyCronSecret } from '@/lib/cron-auth';
import type { FetchResult, NormalizedJob } from '@resumaker/job-engine';

export const maxDuration = 300; // 5 minutes — scraping can take a while

const UPSERT_CHUNK_SIZE = 500;

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

export async function GET(req: NextRequest): Promise<Response> {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const invocationStartedAt = Date.now();

  let companies: Record<string, string[]> = {};
  let fetchers: Record<string, (slug: string) => Promise<FetchResult>>;
  try {
    const engine = await import('@resumaker/job-engine');
    companies = (engine as unknown as { COMPANIES: Record<string, string[]> }).COMPANIES;
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
    const stats: SourceStats = {
      companies: slugs.length,
      fetchErrors: [],
      fetched: 0,
      inserted: 0,
      updated: 0,
      insertErrors: [],
    };
    const collected: NormalizedJob[] = [];

    for (const slug of slugs) {
      let result: FetchResult;
      try {
        result = await fetchFn(slug);
      } catch (err) {
        stats.fetchErrors.push(`${slug}:${(err as Error).message}`);
        continue;
      }
      if (!result.ok) {
        stats.fetchErrors.push(`${slug}:${result.error}`);
        continue;
      }
      stats.fetched += result.jobs.length;
      collected.push(...result.jobs);
    }

    const { inserted, updated, errors } = await upsertJobs(collected, source);
    stats.inserted = inserted;
    stats.updated = updated;
    stats.insertErrors = errors;
    perSource[source] = stats;

    const ok = stats.fetchErrors.length === 0 && stats.insertErrors.length === 0;
    await db.insert(schema.scrapeRuns).values({
      source,
      startedAt: new Date(sourceStartedAt),
      finishedAt: new Date(),
      stats,
      ok,
    });
  }

  const durationMs = Date.now() - invocationStartedAt;
  const allErrors = Object.values(perSource).flatMap((s) => [...s.fetchErrors, ...s.insertErrors]);
  const success = allErrors.length === 0;
  // Use error level if any failures so Vercel cron dashboard surfaces it.
  const logFn = success ? logger.info : logger.error;
  logFn.bind(logger)({ perSource, durationMs, success }, 'cron.scrape_jobs.completed');

  return NextResponse.json({ success, perSource, durationMs });
}
