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
import { resolveModelForUser } from '@/lib/llm/resolve-model';
import { checkRateLimit } from '@/lib/rate-limit';
import { sanitizeInput } from '@resumaker/ai-safety';
import { PromptInjectionError, ValidationError, LLMError } from '@resumaker/shared';
import { canGenerate, getGenerationsToday, getUserTier } from '@/lib/billing/tier';
import { env } from '@/lib/env';

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

  // ─── 2. Tier gate (per-day cap by tier) — fail fast before rate limit ───
  const [tier, generationsToday] = await Promise.all([
    getUserTier(session.user.id),
    getGenerationsToday(session.user.id),
  ]);
  const tierGate = canGenerate(tier, generationsToday);
  if (!tierGate.allowed) {
    return NextResponse.json(
      {
        error: 'Daily generation limit reached for your tier',
        code: 'TIER_LIMIT',
        reasonKey: tierGate.reasonKey,
        requiredTier: tierGate.requiredTier,
        current: tierGate.current,
        limit: tierGate.limit,
      },
      { status: 402 },
    );
  }

  // ─── 3. Rate limit (abuse-defense, shorter window than tier cap) ───
  // Source: validated env. Earlier read of `process.env.RATE_LIMIT_*` directly
  // could return `NaN` when the var was set to garbage, turning the limit
  // check into `current > NaN` (always false → all requests allowed).
  const limit = env.RATE_LIMIT_PER_USER_PER_HOUR;
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

  // ─── 3b. Bound userProfile size to cap LLM cost / prompt injection surface ───
  const profileBytes = JSON.stringify(body.userProfile).length;
  if (profileBytes > 50_000) {
    return NextResponse.json(
      { error: 'Profile too large (max 50KB)', code: 'PAYLOAD_TOO_LARGE' },
      { status: 413 },
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

  // ─── 5. Sanitize userProfile string fields (audit H-1 fix) ───
  const sanitizedProfile: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body.userProfile)) {
    if (typeof value === 'string') {
      const result = sanitizeInput(value);
      if (result.rejected) {
        return NextResponse.json(
          { error: 'Profile field contains suspicious content', field: key },
          { status: 400 },
        );
      }
      sanitizedProfile[key] = result.cleaned;
    } else if (Array.isArray(value)) {
      sanitizedProfile[key] = value.map((v) =>
        typeof v === 'string' ? sanitizeInput(v).cleaned : v,
      );
    } else {
      sanitizedProfile[key] = value;
    }
  }

  // ─── 6. Generate ───
  try {
    const modelString = await resolveModelForUser(session.user.id);
    const result = await generateResume({
      userId: session.user.id,
      locale: jdResult.detectedLocale,
      jobDescription: jdResult.cleaned,
      userProfile: sanitizedProfile,
      modelString,
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
