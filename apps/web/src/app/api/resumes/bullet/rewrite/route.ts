/**
 * POST /api/resumes/bullet/rewrite
 *
 * Rewrites a single resume bullet with Claude. Takes optional JD
 * context to tailor for a specific role. Three tones: impact,
 * concise, formal.
 *
 * Used by the per-highlight sparkle button in the advanced builder
 * and the summary "Rewrite for this JD" button.
 *
 * Cheap (Haiku) + rate-limited (10/hr Free, 30/hr paid).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { getUserTier } from '@/lib/billing/tier';
import { env } from '@/lib/env';
import { logger } from '@/lib/observability';

const MODEL = env.FALLBACK_LLM_MODEL; // Haiku

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

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 30_000 });

export async function POST(req: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tier = await getUserTier(session.user.id);
  const limit = tier === 'free' ? 10 : 30;
  const rl = await checkRateLimit(`bullet-rewrite:${session.user.id}`, limit, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        resetSeconds: rl.resetSeconds,
        limit,
      },
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

  const userMsg = jobDescription
    ? `Rewrite this resume bullet to better match the job description below.\n\nBULLET:\n${bullet}\n\nJOB:\n${jobDescription.slice(0, 4000)}`
    : `Rewrite this resume bullet:\n\n${bullet}`;

  try {
    const result = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });
    const text = result.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim()
      .replace(/^[•·\-*]\s*/, '') // strip stray leading bullet
      .replace(/^["'`]|["'`]$/g, ''); // strip wrapping quotes if model added them
    return NextResponse.json(
      { bullet: text || bullet },
      {
        headers: { 'X-RateLimit-Remaining': String(rl.remaining) },
      },
    );
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'bullet-rewrite.failed');
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
