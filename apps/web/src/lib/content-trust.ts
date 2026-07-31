/**
 * Trust gate for content a user submits into the *shared* jobs feed —
 * currently just manual imports (source='manual'). Separate from
 * beta-gate.ts on purpose: that file controls *access* to the job-hunt
 * surface (now free for everyone), this controls whether something a
 * user publishes there is visible to *other* users immediately or
 * needs admin review first. Two different questions — access and
 * trust — that happened to live behind the same flag once, but
 * shouldn't going forward.
 *
 * A user is trusted (their manual imports publish immediately,
 * status='open') if any of:
 *   1. role='admin' — obviously.
 *   2. role='hr' — has gone through company creation, which is at
 *      least attributable (a real company row, an owner) even though
 *      it isn't necessarily *verified* (see company-verification.ts —
 *      those are independent checks; an unverified HR company still
 *      counts as "trusted enough to skip manual-import review" since
 *      the accountability is the same either way).
 *   3. featureFlags.trustedSharer — admin-granted directly in
 *      /admin/users/[id], or via approving a trustedSharerRequests row
 *      at /admin/moderation.
 *
 * Everyone else's manual imports land as status='pending' — excluded
 * from the shared /jobs feed until an admin approves them, but still
 * visible to the submitter on the job's own detail page (that query
 * has no status filter — see /jobs/[id]/page.tsx).
 */
export function isTrustedSharer(user: {
  role?: string | null;
  featureFlags?: { trustedSharer?: boolean | undefined } | null;
}): boolean {
  if (user.role === 'admin' || user.role === 'hr') return true;
  return user.featureFlags?.trustedSharer === true;
}
