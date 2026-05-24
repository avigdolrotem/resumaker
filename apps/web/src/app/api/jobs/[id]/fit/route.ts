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
import { logger } from '@/lib/observability';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireJobHuntBetaApi(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

  const job = await db.query.jobs.findFirst({
    where: eq(schema.jobs.id, id),
  });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  // Hydrate user profile from latest saved resume (same pattern as the
  // cover-letter flow). If the user has no saved resume yet, score against
  // an empty profile (the AI will return mostly gaps — that's correct).
  const latestResume = await db.query.resumes.findFirst({
    where: eq(schema.resumes.userId, guard.user.id),
    orderBy: (r, { desc }) => [desc(r.updatedAt)],
    columns: { content: true },
  });
  const profile = (latestResume?.content as Record<string, unknown>) ?? {};

  let fit;
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const { computeFitScore } = await import('@resumaker/job-engine');
    const anthropic = new Anthropic();
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
      anthropic,
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
