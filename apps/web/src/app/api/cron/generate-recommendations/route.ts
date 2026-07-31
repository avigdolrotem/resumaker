/**
 * GET /api/cron/generate-recommendations
 *
 * Nightly batch: runs generateRecommendationsForUser (the 3-stage
 * funnel — apps/web/src/lib/recommendations.ts) for every *recently
 * active* user with a completed career profile. The job-hunt surface
 * (including dashboard recommendations) is free for everyone as of
 * 2026-07-31 — see lib/beta-gate.ts — so this no longer restricts by
 * tier; it bounds by activity instead (RECOMMEND_ACTIVE_DAYS), because
 * the funnel's cost is LLM calls per user and free access means user
 * count is no longer self-limiting.
 * generateRecommendationsForUser itself no-ops for anyone without a
 * completed profile, so this could even skip the profile check below
 * and still be correct — kept explicit so a single query shows exactly
 * who this run is scoped to, for the stats this route logs.
 *
 * Also serves as the effective "regenerate after profile save" trigger
 * the original design called for: rather than a debounced per-save
 * hook (needs a delayed-job primitive this app doesn't have), everyone's
 * recommendations simply refresh once a day regardless of what changed.
 * A job-recommendation feature refreshing daily is a perfectly normal
 * cadence — most job boards don't do better than that either.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { logger } from '@/lib/observability';
import { verifyCronSecret } from '@/lib/cron-auth';
import { generateRecommendationsForUser } from '@/lib/recommendations';

export const maxDuration = 300;

/**
 * Only refresh recommendations for users seen within this window. Guards
 * the per-user LLM spend from scaling with total signups rather than
 * with active usage — see the comment at the eligibility query.
 */
const RECOMMEND_ACTIVE_DAYS = 30;

export async function GET(req: NextRequest): Promise<Response> {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const startedAt = Date.now();

  // Activity bound. This funnel makes up to STAGE2_LIMIT (10) LLM calls
  // per user per night. While the surface was invite-only that was a
  // handful of people; now that browsing is free for everyone, "every
  // user who ever completed a profile" grows without limit and is
  // entirely disconnected from revenue — 10k dormant signups would be
  // ~100k model calls a night for accounts that may never return.
  // Restrict to users seen recently: a session whose sliding expiry is
  // still ahead of (now - RECOMMEND_ACTIVE_DAYS) means they signed in
  // within roughly that window.
  const activeSince = new Date(Date.now() - RECOMMEND_ACTIVE_DAYS * 24 * 60 * 60 * 1000);
  const eligibleUsers = await db
    .selectDistinct({ id: schema.users.id })
    .from(schema.users)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .innerJoin(schema.sessions, eq(schema.sessions.userId, schema.users.id))
    .where(
      and(
        isNotNull(schema.profiles.onboardingCompletedAt),
        isNull(schema.users.deletedAt),
        gt(schema.sessions.expiresAt, activeSince),
      ),
    );

  let usersProcessed = 0;
  let totalRecommended = 0;
  const errors: string[] = [];

  for (const user of eligibleUsers) {
    try {
      const result = await generateRecommendationsForUser(user.id);
      usersProcessed++;
      totalRecommended += result.scored;
      if (result.errors.length > 0) {
        errors.push(`${user.id}: ${result.errors.length} job(s) failed to score`);
      }
    } catch (err) {
      errors.push(`${user.id}: ${(err as Error).message}`);
      logger.warn(
        { err: (err as Error).message, userId: user.id },
        'cron.generate_recommendations.user_failed',
      );
    }
  }

  const durationMs = Date.now() - startedAt;
  const stats = {
    eligibleUsers: eligibleUsers.length,
    usersProcessed,
    totalRecommended,
    errors,
    durationMs,
  };
  const success = errors.length === 0;
  const logFn = success ? logger.info : logger.error;
  logFn.bind(logger)(stats, 'cron.generate_recommendations.completed');

  return NextResponse.json({ success, ...stats });
}
