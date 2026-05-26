/**
 * POST /api/resumes/fit-score
 *
 * Job-fit score (1-10) with missing keywords, strengths, and a one-
 * sentence rationale. Complementary to /api/resumes/score (ATS-format-
 * focused) — this one is conversational and aimed at the advanced
 * builder's right-pane fit panel.
 *
 * Locked to the fallback model (Haiku).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { ResumeSchema } from '@resumaker/shared';
import { logger } from '@/lib/observability';
import { generateObject } from '@/lib/llm/provider';

const BodySchema = z.object({
  resume: ResumeSchema,
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

  // Compact resume to keep tokens down — only the fields the score cares about.
  const compact = {
    summary: body.resume.summary,
    skills: body.resume.skills,
    experience: body.resume.experience.map((e) => ({
      title: e.title,
      company: e.company,
      highlights: e.highlights,
    })),
    education: body.resume.education.map((e) => ({
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
      schemaName: 'fit_score',
      schemaDescription: 'Structured assessment of how well the resume fits the job.',
    });
    return NextResponse.json(result.object);
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'fit-score.failed');
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
