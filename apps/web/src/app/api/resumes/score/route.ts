/**
 * POST /api/resumes/score
 *
 * Score a resume against a job description. Body: { resume, jobDescription,
 * resumeId? }. `resumeId` is optional because scoring can happen right
 * after generation, before the resume has been saved (no id to attach a
 * row to yet) — the score still computes and returns either way, it just
 * isn't persisted without one. Pass it whenever a saved resume's id is
 * available so the score shows up in the resume's history, the dashboard's
 * average, and the "see your ATS score" onboarding task.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { scoreResume } from '@resumaker/ats-scorer';
import { ResumeSchema } from '@resumaker/shared';

const BodySchema = z.object({
  resume: ResumeSchema,
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

  const score = scoreResume(body.resume, body.jobDescription);

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
