/**
 * POST /api/jobs/[id]/favorite — toggle favorite on a job.
 *
 * Upserts a user_jobs row when none exists. Returns the new state.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

  const existing = await db.query.userJobs.findFirst({
    where: and(eq(schema.userJobs.jobId, id), eq(schema.userJobs.userId, guard.user.id)),
    columns: { id: true, isFavorite: true },
  });

  if (existing) {
    const next = !existing.isFavorite;
    await db
      .update(schema.userJobs)
      .set({ isFavorite: next, updatedAt: new Date() })
      .where(eq(schema.userJobs.id, existing.id));
    return NextResponse.json({ isFavorite: next });
  }

  await db.insert(schema.userJobs).values({
    userId: guard.user.id,
    jobId: id,
    isFavorite: true,
  });
  return NextResponse.json({ isFavorite: true });
}
