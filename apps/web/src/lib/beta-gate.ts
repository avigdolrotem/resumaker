/**
 * Access gate for the L5 job-hunt surface.
 *
 * Pattern: each API route + Server Component for /jobs and /applications
 * calls `requireJobHuntBeta()` at the top. If the user isn't opted in, the
 * helper returns a 402 (API, so the existing tier-gate/upgrade-modal
 * machinery in lib/api-client.ts picks it up automatically) or redirects
 * to /dashboard (page). Mirrors `requireAdmin`.
 *
 * Three independent ways in, any one is sufficient:
 *  1. `role='admin'` — dogfood/support access, not a billed state.
 *  2. `featureFlags.jobHuntBeta` — hand-picked beta testers, admin-toggled
 *     per-user in /admin/users/[id]. Free access during the beta even
 *     though the feature is tier-gated for everyone else (2026-07-24,
 *     Rotem's decision) — existing testers keep working after this
 *     change, they just stop being the *only* way in.
 *  3. Paid tier (`plus`/`pro`) — 2026-07-24: what was originally a pure
 *     product-readiness flag ("not money-gated... anyone with the flag
 *     gets it regardless of plan") is now *also* money-gated for
 *     everyone outside the beta-tester list. `JobHuntPreview`'s upsell
 *     copy already promised "upgrade to plus" before this was wired up
 *     to actually be true.
 */

import { NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireActiveUser } from '@/lib/auth-guards';
import { getUserTier } from '@/lib/billing/tier';
import type { Tier } from '@/lib/billing/limits';

/**
 * Pure/sync check — admin or beta flag, plus tier when the caller
 * already has one in hand (kept deterministic and DB-free so it stays
 * easy to unit test; see {@link hasJobHuntBetaAsync} for the real
 * DB-backed entry point almost every caller should use instead).
 */
export function hasJobHuntBeta(
  user: {
    role?: string | null;
    featureFlags?: { jobHuntBeta?: boolean | undefined } | null;
  },
  tier?: Tier,
): boolean {
  if (user.role === 'admin') return true;
  if (user.featureFlags?.jobHuntBeta === true) return true;
  return tier !== undefined && tier !== 'free';
}

/**
 * The real check almost every call site wants: admin/flag short-circuit
 * first (no DB round-trip needed for the common beta-tester/admin case),
 * else fall back to a real tier lookup via `getUserTier` — the same
 * canonical accessor every other billing gate uses, so this can't drift
 * out of sync with how tier is computed everywhere else (grace periods,
 * admin-override-to-pro, etc.).
 */
export async function hasJobHuntBetaAsync(user: {
  id: string;
  role?: string | null;
  featureFlags?: { jobHuntBeta?: boolean | undefined } | null;
}): Promise<boolean> {
  if (hasJobHuntBeta(user)) return true;
  const tier = await getUserTier(user.id);
  return hasJobHuntBeta(user, tier);
}

/**
 * API-side gate. Returns the loaded session+user when allowed, else a
 * NextResponse — 402 with the canonical `tier_gate` body shape so
 * `apiFetch` callers automatically get the upgrade modal, same as every
 * other tier-gated route.
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

/** Server-Component-side gate. Redirects to /dashboard if not opted in. */
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
