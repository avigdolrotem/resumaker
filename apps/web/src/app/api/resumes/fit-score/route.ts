/**
 * POST /api/resumes/fit-score
 *
 * Job-fit score (1-10) with missing keywords, strengths, and a one-
 * sentence rationale. Complementary to /api/resumes/score (which is
 * ATS-format-focused) — this one is conversational and aimed at the
 * advanced builder's right-pane fit panel.
 *
 * Haiku + rate-limited.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { ResumeSchema } from '@resumaker/shared';
import { logger } from '@/lib/observability';

const MODEL = env.FALLBACK_LLM_MODEL; // Haiku

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

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 30_000 });

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

  const system = `You assess how well a resume matches a job. Return ONLY valid JSON, no commentary, with this exact shape:
{
  "score": <integer 1-10>,
  "missing_keywords": [<short keywords from the job not in the resume>],
  "strengths": [<resume strengths relevant to the job>],
  "rationale": "<one sentence>"
}`;

  const userMsg = `RESUME:\n${JSON.stringify(compact)}\n\nJOB:\n${body.jobDescription.slice(0, 6000)}`;

  try {
    const result = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });
    const text = result.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim();
    // Strip any markdown fences the model added despite the prompt.
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      logger.error({ raw: cleaned.slice(0, 200) }, 'fit-score.json_parse_failed');
      return NextResponse.json({ error: 'Score parse failed' }, { status: 502 });
    }
    const validated = ResponseSchema.safeParse(parsed);
    if (!validated.success) {
      logger.error({ err: validated.error.message }, 'fit-score.shape_invalid');
      return NextResponse.json({ error: 'Score shape invalid' }, { status: 502 });
    }
    return NextResponse.json(validated.data);
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'fit-score.failed');
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
