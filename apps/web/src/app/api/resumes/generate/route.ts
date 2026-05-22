/**
 * POST /api/resumes/generate
 *
 * Generate a tailored resume from a job description.
 *
 * Auth: required (Better Auth session)
 * Rate limit: per RATE_LIMIT_PER_USER_PER_HOUR
 *
 * Body:
 *   {
 *     "jobDescription"?: string,
 *     "jobUrl"?: string,
 *     "userProfile": { name, email, ... },
 *     "locale"?: "he" | "en" | "auto",
 *     "industry"?: "tech" | "healthcare" | "finance" | "general"
 *   }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { parseJD } from '@/lib/jd-parser';
import { generateResume } from '@/lib/llm';
import { checkRateLimit } from '@/lib/rate-limit';
import { PromptInjectionError, ValidationError, LLMError } from '@resumaker/shared';

const BodySchema = z
  .object({
    jobDescription: z.string().max(20_000).optional(),
    jobUrl: z.string().url().optional(),
    userProfile: z.record(z.unknown()),
    locale: z.enum(['he', 'en', 'auto']).default('auto'),
    industry: z.enum(['tech', 'healthcare', 'finance', 'general']).optional(),
  })
  .refine((d) => d.jobDescription || d.jobUrl, {
    message: 'Either jobDescription or jobUrl required',
  });

export async function POST(req: NextRequest): Promise<Response> {
  // ─── 1. Auth ───
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ─── 2. Rate limit ───
  const limit = parseInt(process.env.RATE_LIMIT_PER_USER_PER_HOUR ?? '10', 10);
  const rl = await checkRateLimit(`gen:user:${session.user.id}`, limit, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterSeconds: rl.resetSeconds },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.resetSeconds),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      },
    );
  }

  // ─── 3. Parse body ───
  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await req.json();
    body = BodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  // ─── 4. Parse JD ───
  let jdResult;
  try {
    jdResult = await parseJD({
      ...(body.jobDescription ? { text: body.jobDescription } : {}),
      ...(body.jobUrl ? { url: body.jobUrl } : {}),
      forceLocale: body.locale,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'JD parse failed', detail: (err as Error).message },
      { status: 400 },
    );
  }

  // ─── 5. Generate ───
  try {
    const result = await generateResume({
      userId: session.user.id,
      locale: jdResult.detectedLocale,
      jobDescription: jdResult.cleaned,
      userProfile: body.userProfile,
      ...(body.industry ? { industry: body.industry } : {}),
    });

    return NextResponse.json({
      resume: result.resume,
      generationId: result.generationId,
      metadata: {
        durationMs: result.durationMs,
        tokensUsed: result.tokensUsed,
        detectedLocale: jdResult.detectedLocale,
        source: jdResult.source,
      },
    });
  } catch (err) {
    if (err instanceof PromptInjectionError) {
      return NextResponse.json({ error: 'Suspicious input detected' }, { status: 400 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: 'LLM produced invalid output' }, { status: 502 });
    }
    if (err instanceof LLMError) {
      return NextResponse.json({ error: 'LLM service error' }, { status: 502 });
    }
    console.error('[generate] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
