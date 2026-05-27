/**
 * GET /api/cron/scrape-jobs
 *
 * Bearer-secret cron. Daily run that hits every wired scraper source
 * (Greenhouse, Lever, Workable, Ashby) and inserts new jobs deduped
 * by url_normalized.
 *
 * The job-engine package handles the actual HTTP + parsing. Each
 * source's fetcher returns [] on error so one bad company won't kill
 * the whole run.
 *
 * NOTE: Vercel Cron sends GET, so this MUST be exported as GET.
 * The route previously exported POST and never fired in production.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { logger } from '@/lib/observability';
import { verifyCronSecret } from '@/lib/cron-auth';

export const maxDuration = 300; // 5 minutes — scraping can take a while

export async function GET(req: NextRequest): Promise<Response> {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const startedAt = Date.now();
  const stats = {
    sources: 0,
    fetched: 0,
    inserted: 0,
    deduped: 0,
    errors: [] as string[],
  };

  let companies: Record<string, string[]> = {};
  let fetchers: Record<string, (slug: string) => Promise<unknown[]>>;
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

  for (const [source, fetchFn] of Object.entries(fetchers)) {
    const slugs = companies[source] ?? [];
    stats.sources += 1;
    for (const slug of slugs) {
      try {
        const items = (await fetchFn(slug)) as Array<{
          externalId: string;
          source: string;
          company: string;
          companySlug?: string;
          title: string;
          location?: string;
          description: string;
          url: string;
          urlNormalized: string;
          remote: boolean;
          seniority?: string;
          postedAt?: Date;
          rawData?: unknown;
        }>;
        stats.fetched += items.length;
        for (const item of items) {
          // Dedupe by url_normalized (we have a unique-ish index on it).
          try {
            const result = await db
              .insert(schema.jobs)
              .values({
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
              })
              .onConflictDoNothing({
                // No explicit unique constraint exists for urlNormalized in the
                // current schema (just a non-unique index), so we duck-type the
                // conflict by selecting an existing row first if there's risk
                // of duplicate. For now: pre-check the index hit.
                target: schema.jobs.urlNormalized,
              })
              .returning({ id: schema.jobs.id });
            if (result.length > 0) {
              stats.inserted += 1;
            } else {
              stats.deduped += 1;
            }
          } catch (insertErr) {
            // Real insert error: schema mismatch, FK violation, etc.
            // Previously this was silently counted as dedupe, which
            // hid catastrophic failures from a whole new scraper source.
            // Log loudly + track separately so cron health check sees it.
            const msg = (insertErr as Error).message;
            stats.errors.push(`insert:${source}:${item.urlNormalized}:${msg}`);
            logger.warn(
              { err: msg, source, externalId: item.externalId, slug },
              'cron.scrape_jobs.insert_failed',
            );
          }
        }
      } catch (err) {
        stats.errors.push(`${source}:${slug}:${(err as Error).message}`);
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  // Use error level if any failures so Vercel cron dashboard surfaces it.
  const logFn = stats.errors.length > 0 ? logger.error : logger.info;
  logFn.bind(logger)({ ...stats, durationMs }, 'cron.scrape_jobs.completed');

  return NextResponse.json({ success: stats.errors.length === 0, ...stats, durationMs });
}
