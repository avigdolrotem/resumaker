/**
 * Access gate for the L5 job-hunt surface (/jobs, /applications).
 *
 * 2026-07-31, Rotem's decision: the whole surface is free for any
 * signed-in user now — browsing/tracking earns nothing on their own,
 * only resume *generation* is paid (see billing/limits.ts's
 * `generationsPerDay`). These functions are kept as always-true
 * pass-throughs rather than deleted and their ~20 call sites edited
 * individually: every route/page still calls requireJobHuntBetaApi /
 * requireJobHuntBetaPage / hasJobHuntBetaAsync exactly as before, so if
 * this surface is ever gated again, there's one place to change instead
 * of re-auditing every call site. `featureFlags.jobHuntBeta` and its
 * admin-panel toggle are now inert (no functional effect) but left in
 * place rather than migrated out for the same reason.
 */

import { NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireActiveUser } from '@/lib/auth-guards';
import type { Tier } from '@/lib/billing/limits';

/** Always true now — kept for signature compatibility, see file header. */
export function hasJobHuntBeta(
  _user: {
    role?: string | null;
    featureFlags?: { jobHuntBeta?: boolean | undefined } | null;
  },
  _tier?: Tier,
): boolean {
  return true;
}

/** Always true now — kept for signature compatibility, see file header. */
export async function hasJobHuntBetaAsync(_user: {
  id: string;
  role?: string | null;
  featureFlags?: { jobHuntBeta?: boolean | undefined } | null;
}): Promise<boolean> {
  return true;
}

/**
 * API-side gate. hasJobHuntBetaAsync always returns true now, so this
 * is effectively requireActiveUser with the same call signature every
 * route already uses — the 402 branch is unreachable dead code, kept
 * only so a future re-gate has a body to fill in rather than a route
 * shape to rebuild.
 */
export async function requireJobHuntBetaApi(headers: Headers) {
  const guard = await requireActiveUser(headers);
  if (guard instanceof NextResponse) return guard;
  if (!(await hasJobHuntBetaAsync(guard.user))) {
    return NextResponse.json(
      { error: 'tier_gate', feature: 'job_hunt_beta', requiredTier: 'plus' },
      { status: 402 },
    );
  }
  return guard;
}

/**
 * Server-Component-side gate. Still redirects an unauthenticated visitor
 * to /sign-in — that part is real. The /dashboard redirect below it is
 * unreachable (hasJobHuntBetaAsync always returns true now), kept for
 * the same reason as requireJobHuntBetaApi's dead branch above.
 */
export async function requireJobHuntBetaPage() {
  const guard = await requireActiveUser(await nextHeaders());
  if (guard instanceof NextResponse) {
    redirect('/sign-in');
  }
  if (!(await hasJobHuntBetaAsync(guard.user))) {
    redirect('/dashboard');
  }
  return guard;
}
