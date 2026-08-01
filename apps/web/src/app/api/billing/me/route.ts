/**
 * GET /api/billing/me — current user's tier, usage, and limits
 *
 * Always returns something useful even when Stripe is off, so the
 * UI can render gates / "upgrade" CTAs from a single source. The
 * `stripeEnabled` flag tells the client whether to render checkout
 * buttons or "coming soon" copy.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireActiveUser } from '@/lib/auth-guards';
import {
  getUserTier,
  getActiveResumeCount,
  getGenerationsToday,
  getCoverLettersThisMonth,
} from '@/lib/billing/tier';
import { TIER_LIMITS } from '@/lib/billing/limits';
import { getProviderInfo } from '@/lib/billing/provider';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const userId = guard.user.id;

  const [tier, resumeCount, generationsToday, coverLettersThisMonth] = await Promise.all([
    getUserTier(userId),
    getActiveResumeCount(userId),
    getGenerationsToday(userId),
    getCoverLettersThisMonth(userId),
  ]);

  const limits = TIER_LIMITS[tier];

  const providerInfo = getProviderInfo();

  return NextResponse.json({
    tier,
    limits,
    usage: {
      resumes: resumeCount,
      generationsToday,
      coverLettersThisMonth,
    },
    provider: providerInfo.provider,
    checkoutReady: providerInfo.checkoutReady,
  });
}
