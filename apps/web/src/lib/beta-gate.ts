/**
 * Auth guards for the job-hunt surface (/jobs, /applications).
 *
 * These were once a real gate (admin / featureFlags.jobHuntBeta / paid
 * tier). As of 2026-07-31 that surface is free to every signed-in user —
 * browsing and tracking earn nothing on their own, only resume
 * *generation* is paid (see billing/limits.ts). The gate first became an
 * always-true pass-through, which left the branches below unreachable
 * and a trail of dead scaffolding behind them (a blurred "preview"
 * upsell page for each surface, a locked nav item, an upgrade modal
 * keyed to a `job_hunt_beta` feature) that could never render again.
 * All of that is now deleted, and what remains here is plain auth.
 *
 * The two functions keep their names purely so their ~17 call sites
 * don't need touching, and so re-gating this surface later means editing
 * one file rather than re-auditing every route. `featureFlags.jobHuntBeta`
 * still exists on the users row and is still toggleable in
 * /admin/users/[id]; it currently controls nothing.
 */

import { NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireActiveUser } from '@/lib/auth-guards';

/**
 * API-side guard: loads the session and rejects suspended/deleted
 * accounts. Identical to `requireActiveUser` — kept as a named seam for
 * the job-hunt routes.
 */
export async function requireJobHuntBetaApi(headers: Headers) {
  return requireActiveUser(headers);
}

/** Server-Component-side guard. Redirects an unauthenticated visitor to /sign-in. */
export async function requireJobHuntBetaPage() {
  const guard = await requireActiveUser(await nextHeaders());
  if (guard instanceof NextResponse) {
    redirect('/sign-in');
  }
  return guard;
}
