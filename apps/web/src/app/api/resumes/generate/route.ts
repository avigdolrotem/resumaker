/**
 * POST /api/resumes/generate
 *
 * Generate a tailored resume from a job description, using the
 * caller's own canonical career profile as source data (read
 * server-side — the client no longer submits userProfile, since
 * there's exactly one profile per user, not one per generation).
 *
 * Auth: required (Better Auth session)
 * Rate limit: per RATE_LIMIT_PER_USER_PER_HOUR
 *
 * Body:
 *   {
 *     "jobDescription"?: string,
 *     "jobUrl"?: string,
 *     "locale"?: "he" | "en" | "auto"
 *   }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { parseJD } from '@/lib/jd-parser';
import { generateResume } from '@/lib/llm';
import { resolveModelForUser } from '@/lib/llm/resolve-model';
import { checkRateLimit } from '@/lib/rate-limit';
import { sanitizeInput } from '@resumaker/ai-safety';
import { PromptInjectionError, ValidationError, LLMError } from '@resumaker/shared';
import { canGenerate, getGenerationsToday, getUserTier } from '@/lib/billing/tier';
import { env } from '@/lib/env';
import { logger } from '@/lib/observability';

const BodySchema = z
  .object({
    jobDescription: z.string().max(20_000).optional(),
    jobUrl: z.string().url().optional(),
    locale: z.enum(['he', 'en', 'auto']).default('auto'),
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

  // ─── 3b. Load the caller's career profile — the source data for
  // every generation now, not a per-request payload. A user who hasn't
  // finished onboarding (or skipped it entirely) has no profile row;
  // the builder UI should route them to /career-profile first, but
  // this is the actual enforcement point.
  const profileRow = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, session.user.id),
  });
  if (!profileRow || !profileRow.onboardingCompletedAt) {
    return NextResponse.json(
      { error: 'Complete your career profile before generating a resume', code: 'NO_PROFILE' },
      { status: 409 },
    );
  }
  const userProfile = profileRow.content as Record<string, unknown>;

  // Bound profile size to cap LLM cost / prompt injection surface — a
  // defensive check, not expected to trip in practice since PATCH
  // /api/profile enforces per-field limits via ProfileContentSchema.
  const profileBytes = JSON.stringify(userProfile).length;
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

  // ─── 5. Sanitize userProfile string fields, recursively (audit H-1
  // fix). The profile is now the full nested ProfileContent shape
  // (contact object, experience/education/projects arrays of objects,
  // etc.) rather than the old flat basic-mode form — a shallow
  // one-level walk would silently skip almost all of it (nested
  // objects and arrays-of-objects both fell into the pass-through
  // branch), so this recurses into every level instead.
  let rejectedField: string | null = null;
  function sanitizeDeep(value: unknown, path: string): unknown {
    if (rejectedField) return value;
    if (typeof value === 'string') {
      const result = sanitizeInput(value);
      if (result.rejected) {
        rejectedField = path;
        return value;
      }
      return result.cleaned;
    }
    if (Array.isArray(value)) {
      return value.map((v, i) => sanitizeDeep(v, `${path}[${i}]`));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, sanitizeDeep(v, path ? `${path}.${k}` : k)]),
      );
    }
    return value;
  }
  const sanitizedProfile = sanitizeDeep(userProfile, '') as Record<string, unknown>;
  if (rejectedField) {
    return NextResponse.json(
      { error: 'Profile field contains suspicious content', field: rejectedField },
      { status: 400 },
    );
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
    });

    return NextResponse.json({
      resume: result.resume,
      jobTitle: result.jobTitle,
      companyName: result.companyName,
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
      logger.error(
        { err: err.message, cause: err.cause instanceof Error ? err.cause.message : err.cause },
        'resume.generate.output_invalid',
      );
      return NextResponse.json({ error: 'LLM produced invalid output' }, { status: 502 });
    }
    if (err instanceof LLMError) {
      // The user-facing message stays generic (no provider internals
      // leaked), but the real cause was previously discarded entirely —
      // undiagnosable from outside a debugger. Log it server-side.
      logger.error(
        { err: err.message, cause: err.cause instanceof Error ? err.cause.message : err.cause },
        'resume.generate.llm_error',
      );
      return NextResponse.json({ error: 'LLM service error' }, { status: 502 });
    }
    logger.error({ err: (err as Error).message }, 'resume.generate.failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
