/**
 * POST /api/jobs/[id]/fit — compute fit-score for a job vs. user profile.
 *
 * Persists the result on user_jobs so subsequent reads return it cached.
 * Uses haiku via @resumaker/job-engine (cheap + fast).
 *
 * If the LLM call fails (rate limit, key missing), returns a 502 — the
 * UI shows "Couldn't score" and lets the user retry.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireJobHuntBetaApi } from '@/lib/beta-gate';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/observability';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  // See the matching comment in applications/[id]/prep/route.ts — this
  // beta-surface LLM route had no rate limit, unlike every other one.
  const rl = await checkRateLimit(`job-fit:${guard.user.id}`, 30, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', resetSeconds: rl.resetSeconds },
      { status: 429 },
    );
  }

  const { id } = await params;

  const job = await db.query.jobs.findFirst({
    where: eq(schema.jobs.id, id),
  });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  // Hydrate user profile from the canonical career profile — same source
  // /api/resumes/generate and /api/resumes/score use. This used to read
  // the user's most recently *saved resume* instead, which is wrong: that
  // resume was tailored to whichever job it was originally generated for,
  // not this one, so a user who saved a resume for Job A would get Job A's
  // tailored content scored against Job B's description here. The
  // canonical profile is JD-independent, so it's a fair comparison no
  // matter which job is being scored. If the user has no profile yet,
  // score against an empty one (the AI will return mostly gaps — correct).
  const profileRow = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, guard.user.id),
  });
  const profile = (profileRow?.content as Record<string, unknown>) ?? {};

  let fit;
  try {
    const { computeFitScore } = await import('@resumaker/job-engine');
    fit = await computeFitScore({
      profile,
      job: {
        externalId: job.externalId ?? job.id,
        source: job.source as 'manual',
        company: job.company,
        title: job.title,
        ...(job.location ? { location: job.location } : {}),
        description: job.description,
        url: job.url,
        urlNormalized: job.urlNormalized,
        remote: job.remote,
      },
    });
  } catch (err) {
    logger.error(
      { err: (err as Error).message, jobId: id, userId: guard.user.id },
      'jobs.fit.llm_failed',
    );
    return NextResponse.json({ error: 'Could not score fit' }, { status: 502 });
  }

  // Upsert user_jobs row with the scored fit
  const existing = await db.query.userJobs.findFirst({
    where: and(eq(schema.userJobs.jobId, id), eq(schema.userJobs.userId, guard.user.id)),
    columns: { id: true },
  });
  if (existing) {
    await db
      .update(schema.userJobs)
      .set({
        fitScore: fit.score,
        fitRationale: fit.rationale,
        fitStrengths: fit.strengths,
        fitGaps: fit.gaps,
        updatedAt: new Date(),
      })
      .where(eq(schema.userJobs.id, existing.id));
  } else {
    await db.insert(schema.userJobs).values({
      userId: guard.user.id,
      jobId: id,
      fitScore: fit.score,
      fitRationale: fit.rationale,
      fitStrengths: fit.strengths,
      fitGaps: fit.gaps,
    });
  }

  return NextResponse.json({ fit });
}
