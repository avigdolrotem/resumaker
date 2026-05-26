/**
 * POST /api/resumes/bullet/rewrite
 *
 * Rewrites a single resume bullet. Three tones: impact, concise, formal.
 * Used by the per-highlight sparkle button in the advanced builder and
 * the summary "Rewrite for this JD" button.
 *
 * Locked to the fallback model (Haiku) — this is a background utility,
 * not user-facing model selection.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { getUserTier } from '@/lib/billing/tier';
import { env } from '@/lib/env';
import { logger } from '@/lib/observability';
import { generateText } from '@/lib/llm/provider';

const BodySchema = z.object({
  bullet: z.string().min(1).max(500),
  jobDescription: z.string().max(20_000).optional(),
  tone: z.enum(['impact', 'concise', 'formal']).default('impact'),
});

const TONES: Record<z.infer<typeof BodySchema>['tone'], string> = {
  impact: 'Focus on quantifiable impact, active verbs, and concrete outcomes.',
  concise: 'Tighten to under 20 words. Cut filler words. Lead with action.',
  formal: 'Use formal corporate tone, no contractions, third-person friendly.',
};

export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tier = await getUserTier(session.user.id);
  const limit = tier === 'free' ? 10 : 30;
  const rl = await checkRateLimit(`bullet-rewrite:${session.user.id}`, limit, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', resetSeconds: rl.resetSeconds, limit },
      { status: 429, headers: { 'X-RateLimit-Remaining': '0' } },
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

  const { bullet, jobDescription, tone } = body;
  const system = `You rewrite resume bullets to be stronger. ${TONES[tone]} Return ONLY the rewritten bullet, no commentary, no quotation marks, no leading bullet character.`;

  const prompt = jobDescription
    ? `Rewrite this resume bullet to better match the job description below.\n\nBULLET:\n${bullet}\n\nJOB:\n${jobDescription.slice(0, 4000)}`
    : `Rewrite this resume bullet:\n\n${bullet}`;

  try {
    const result = await generateText({
      model: env.FALLBACK_LLM_MODEL,
      system,
      prompt,
      maxOutputTokens: 200,
    });
    const text = result.text
      .trim()
      .replace(/^[•·\-*]\s*/, '')
      .replace(/^["'`]|["'`]$/g, '');
    return NextResponse.json(
      { bullet: text || bullet },
      { headers: { 'X-RateLimit-Remaining': String(rl.remaining) } },
    );
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'bullet-rewrite.failed');
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
