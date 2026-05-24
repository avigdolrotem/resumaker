/**
 * GET /api/jobs/[id] — fetch one job + the current user's joined state
 *                       (favorite + fit-score). Beta-gated.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

  const [row] = await db
    .select({
      id: schema.jobs.id,
      source: schema.jobs.source,
      company: schema.jobs.company,
      title: schema.jobs.title,
      location: schema.jobs.location,
      description: schema.jobs.description,
      url: schema.jobs.url,
      remote: schema.jobs.remote,
      seniority: schema.jobs.seniority,
      postedAt: schema.jobs.postedAt,
      scrapedAt: schema.jobs.scrapedAt,
      isFavorite: schema.userJobs.isFavorite,
      fitScore: schema.userJobs.fitScore,
      fitRationale: schema.userJobs.fitRationale,
      fitStrengths: schema.userJobs.fitStrengths,
      fitGaps: schema.userJobs.fitGaps,
    })
    .from(schema.jobs)
    .leftJoin(
      schema.userJobs,
      and(eq(schema.userJobs.jobId, schema.jobs.id), eq(schema.userJobs.userId, guard.user.id)),
    )
    .where(eq(schema.jobs.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ job: row });
}
