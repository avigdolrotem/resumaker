/**
 * Referral qualification.
 *
 * The referral pipeline is pending → qualified → rewarded (see the
 * comment on the `referrals` table). `pending` rows are written by
 * /api/referrals/claim at signup. This file owns the pending →
 * qualified transition, called from both billing webhook handlers
 * (Stripe + LemonSqueezy) at the exact moment a referred user's FIRST
 * payment completes — matching the referral page's own copy ("earn
 * rewards when your friends subscribe").
 *
 * Deliberately NOT wired to auto-grant a reward here. Doing that
 * safely means either mutating a live subscription row (real risk of
 * clobbering a paying customer's plan if the safety logic has a bug)
 * or building a consumer-facing coupon-redemption flow that doesn't
 * exist yet (the coupons/couponRedemptions tables are currently
 * admin-management-only — nothing applies one at checkout). Both are
 * a materially bigger, higher-stakes change than "track qualification"
 * is. Marking `qualifiedAt` gives admins a real, queryable signal
 * (`SELECT * FROM referrals WHERE status = 'qualified'`) to act on via
 * the existing, already-safety-checked POST /api/admin/users/[id]/tier
 * grant route — reward *policy* (what to grant, how much) stays a
 * human decision; this only makes the underlying event real.
 */

import { eq, and } from 'drizzle-orm';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { logger } from '@/lib/observability';

/**
 * Call once a user's first payment has completed. No-ops for the
 * (vast majority of) users who weren't referred, and is safe to call
 * more than once for the same user — only a `pending` row transitions,
 * so a later renewal/update webhook hitting this again is a harmless
 * no-op.
 */
export async function markReferralQualifiedIfPending(referredUserId: string): Promise<void> {
  try {
    const [updated] = await db
      .update(schema.referrals)
      .set({ status: 'qualified', qualifiedAt: new Date() })
      .where(
        and(
          eq(schema.referrals.referredId, referredUserId),
          eq(schema.referrals.status, 'pending'),
        ),
      )
      .returning({ id: schema.referrals.id, referrerId: schema.referrals.referrerId });

    if (updated) {
      auditEvent({
        userId: updated.referrerId,
        event: 'referral_qualified',
        metadata: { referredUserId, referralId: updated.id },
      });
    }
  } catch (err) {
    // Never let referral bookkeeping fail a payment webhook — the
    // subscription itself is already committed by the time this runs.
    logger.warn({ err: (err as Error).message, referredUserId }, 'referral.qualify_failed');
  }
}
