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
 * found at two sources doesn't show up twice. Also defaults to
 * Israeli-only (location string match, or source in taasuka/hr which
 * are Israeli by construction) — pass includeNonIsraeli=true to lift
 * that. This is a plain lookup against an already-clean structured
 * field, not something that needs an LLM.
 *
 * Pagination: real pages (page=1,2,3…), ordered by `scrapedAt` desc
 * (newest first) when unfiltered, or by rank desc when `q` is set
 * (full-text relevance, not recency, matters for a search). Page size
 * — see @/lib/jobs-query's PAGE_SIZE.
 *
 * The actual query lives in @/lib/jobs-query's listJobs() — shared with
 * /jobs's initial server-rendered page so client-side page navigation
 * can never drift from what the first page showed.
 *
 * L5 beta-gated.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';
import { listJobs } from '@/lib/jobs-query';

export async function GET(req: NextRequest): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  const sp = req.nextUrl.searchParams;
  const q = sp.get('q');
  const company = sp.get('company');
  const source = sp.get('source');
  const remote = sp.get('remote');
  const page = Number(sp.get('page') ?? '1');

  const result = await listJobs({
    userId: guard.user.id,
    ...(q && { q }),
    ...(company && { company }),
    ...(source && { source }),
    ...(remote === 'true' && { remote: true }),
    ...(remote === 'false' && { remote: false }),
    favoriteOnly: sp.get('favorite') === 'true',
    includeClosed: sp.get('includeClosed') === 'true',
    israeliOnly: sp.get('includeNonIsraeli') !== 'true',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  });

  return NextResponse.json(result);
}
