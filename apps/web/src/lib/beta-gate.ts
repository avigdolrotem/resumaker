/**
 * Beta-flag gate for the L5 job-hunt surface.
 *
 * Pattern: each API route + Server Component for /jobs and /applications
 * calls `requireJobHuntBeta()` at the top. If the user isn't opted in
 * (admin toggles it per-user in /admin/users/[id]), the helper returns a
 * 404 (API) or redirects to /dashboard (page). Mirrors `requireAdmin`.
 *
 * Why a flag, not a "tier feature": the beta is product-readiness gated,
 * not money-gated. Anyone with the flag enabled gets it regardless of
 * plan. Once the feature ships GA we just default the flag to true and
 * delete this helper.
 */

import { NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireActiveUser } from '@/lib/auth-guards';

/** True if the user has the job-hunt beta flag on. */
export function hasJobHuntBeta(user: { featureFlags?: { jobHuntBeta?: boolean } | null }): boolean {
  return user.featureFlags?.jobHuntBeta === true;
}

/**
 * API-side gate. Returns the loaded session+user when allowed, else a
 * NextResponse (404 to not advertise the route's existence to non-beta
 * users).
 */
export async function requireJobHuntBetaApi(headers: Headers) {
  const guard = await requireActiveUser(headers);
  if (guard instanceof NextResponse) return guard;
  if (!hasJobHuntBeta(guard.user)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return guard;
}

/** Server-Component-side gate. Redirects to /dashboard if not opted in. */
export async function requireJobHuntBetaPage() {
  const guard = await requireActiveUser(await nextHeaders());
  if (guard instanceof NextResponse) {
    redirect('/sign-in');
  }
  if (!hasJobHuntBeta(guard.user)) {
    redirect('/dashboard');
  }
  return guard;
}
