/**
 * POST /api/resumes/score
 *
 * Score the caller's career profile against a job description. Body:
 * { jobDescription, resumeId? }. `resumeId` is optional because scoring
 * can happen right after generation, before the resume has been saved
 * (no id to attach a row to yet) — the score still computes and returns
 * either way, it just isn't persisted without one. Pass it whenever a
 * saved resume's id is available so the score shows up in the resume's
 * history, the dashboard's average, and the "see your ATS score"
 * onboarding task.
 *
 * Scores the profile, not the generated resume (audit finding, see
 * packages/ats-scorer/src/index.ts) — the scorer extracts its keyword
 * list from this same jobDescription, and a resume the LLM just tailored
 * to that exact JD will echo most of those keywords back by construction,
 * regardless of whether the candidate is a real fit. That's a closed
 * loop, not a measurement — every generation scored close to 100 no
 * matter the underlying match. The profile is written once, independent
 * of any particular JD, so scoring it against a JD is an actual test of
 * fit rather than a test of how well the LLM parroted the posting.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { scoreResume } from '@resumaker/ats-scorer';
import type { Resume } from '@resumaker/shared';

const BodySchema = z.object({
  jobDescription: z.string().min(10).max(20_000),
  resumeId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  // Same source of truth as /api/resumes/generate: one profile per user,
  // read server-side rather than trusted from the request body.
  const profileRow = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, session.user.id),
  });
  if (!profileRow || !profileRow.onboardingCompletedAt) {
    return NextResponse.json(
      { error: 'Complete your career profile before scoring', code: 'NO_PROFILE' },
      { status: 409 },
    );
  }

  // ProfileContentSchema is ResumeSchema.omit({ metadata: true }) — the
  // scorer never reads .metadata, so the profile is a direct fit.
  const score = scoreResume(profileRow.content as Resume, body.jobDescription);

  if (body.resumeId) {
    // Ownership check — don't let a caller attach a score to a resume
    // that isn't theirs just by passing its id.
    const owned = await db.query.resumes.findFirst({
      where: and(
        eq(schema.resumes.id, body.resumeId),
        eq(schema.resumes.userId, session.user.id),
        isNull(schema.resumes.deletedAt),
      ),
      columns: { id: true },
    });
    if (owned) {
      await db.insert(schema.atsScores).values({
        resumeId: body.resumeId,
        overall: score.overall,
        // Scorer output is snake_case (matches the public ATSScoreSchema
        // in @resumaker/shared); the Drizzle columns are camelCase JS
        // properties mapped to the same snake_case DB columns — map
        // explicitly rather than relying on the names lining up.
        matchedKeywords: score.matched_keywords,
        missingKeywords: score.missing_keywords,
        suggestions: score.suggestions,
      });
    }
  }

  return NextResponse.json(score);
}
