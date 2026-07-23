/**
 * POST /api/resumes/fit-score
 *
 * Job-fit score (1-10) with missing keywords, strengths, and a one-
 * sentence rationale. Complementary to /api/resumes/score (ATS-format-
 * focused) — this one is conversational and aimed at the advanced
 * builder's right-pane fit panel.
 *
 * Scores the caller's canonical career profile, not a client-submitted
 * resume — see the doc comment on /api/resumes/score for why scoring a
 * resume the LLM already tailored to this exact JD produces an inflated,
 * meaningless number. Same fix, same reason, applied here for consistency
 * (this route currently has no caller — see below).
 *
 * Locked to the fallback model (Haiku).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import type { Resume } from '@resumaker/shared';
import { logger } from '@/lib/observability';
import { generateObject } from '@/lib/llm/provider';

const BodySchema = z.object({
  jobDescription: z.string().min(10).max(20_000),
});

const ResponseSchema = z.object({
  score: z.number().int().min(1).max(10),
  missing_keywords: z.array(z.string()).max(20),
  strengths: z.array(z.string()).max(10),
  rationale: z.string().max(500),
});

export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await checkRateLimit(`fit-score:${session.user.id}`, 60, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', resetSeconds: rl.resetSeconds },
      { status: 429 },
    );
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

  // Same source of truth as /api/resumes/generate and /api/resumes/score:
  // one profile per user, read server-side.
  const profileRow = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, session.user.id),
  });
  if (!profileRow || !profileRow.onboardingCompletedAt) {
    return NextResponse.json(
      { error: 'Complete your career profile before scoring', code: 'NO_PROFILE' },
      { status: 409 },
    );
  }
  // ProfileContentSchema is ResumeSchema.omit({ metadata: true }) — none
  // of the fields read below are metadata, so the profile is a direct fit.
  const resume = profileRow.content as Resume;

  // Compact resume to keep tokens down — only the fields the score cares about.
  const compact = {
    summary: resume.summary,
    skills: resume.skills,
    experience: resume.experience.map((e) => ({
      title: e.title,
      company: e.company,
      highlights: e.highlights,
    })),
    education: resume.education.map((e) => ({
      degree: e.degree,
      field: e.field,
    })),
  };

  const system =
    'You assess how well a resume matches a job. Output via the structured schema only.';

  const prompt = `RESUME:\n${JSON.stringify(compact)}\n\nJOB:\n${body.jobDescription.slice(0, 6000)}`;

  try {
    const result = await generateObject({
      model: env.FALLBACK_LLM_MODEL,
      schema: ResponseSchema,
      system,
      prompt,
      maxOutputTokens: 512,
      // Same class of task as tools/ats-scanner (quick structured
      // classification, no multi-step reasoning needed) — see that
      // route for why disableThinking matters for Gemini specifically:
      // without it, "thinking" can silently eat most of a modest output
      // budget before any visible/schema-conforming output is produced.
      disableThinking: true,
      schemaName: 'fit_score',
      schemaDescription: 'Structured assessment of how well the resume fits the job.',
    });
    return NextResponse.json(result.object);
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'fit-score.failed');
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
