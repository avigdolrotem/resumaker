/**
 * POST /api/jobs/[id]/dismiss
 *
 * Marks a recommended job as dismissed for the current user — excluded
 * from every future recommendation run (generateRecommendationsForUser's
 * Stage 2 filters on this) but the row, and any favorite/application on
 * it, stays intact. Permanent: no future batch run clears dismissedAt
 * for a job the user already dismissed (see recommendations.ts's doc
 * comment on why).
 *
 * Upserts rather than requiring an existing userJobs row — a job can be
 * dismissed straight from the dashboard recommendation card before the
 * user has favorited or otherwise interacted with it.
 *
 * L5 beta-gated, same as every other /api/jobs route.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db, schema } from '@/db';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

  const job = await db.query.jobs.findFirst({
    where: eq(schema.jobs.id, id),
    columns: { id: true },
  });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const now = new Date();
  const existing = await db.query.userJobs.findFirst({
    where: and(eq(schema.userJobs.userId, guard.user.id), eq(schema.userJobs.jobId, id)),
    columns: { id: true },
  });

  if (existing) {
    await db
      .update(schema.userJobs)
      .set({ dismissedAt: now, updatedAt: now })
      .where(eq(schema.userJobs.id, existing.id));
  } else {
    await db.insert(schema.userJobs).values({ userId: guard.user.id, jobId: id, dismissedAt: now });
  }

  return NextResponse.json({ success: true });
}
