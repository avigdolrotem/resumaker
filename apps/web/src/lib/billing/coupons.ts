/**
 * Coupon validation + redemption.
 *
 * Until this existed the coupon feature was decorative: an admin could
 * create a row, but the code never reached a payment provider,
 * `couponRedemptions` was never written, and the admin panel's
 * "usageCount / usageLimit" could only ever read 0. This file is the
 * missing half — validation at checkout, and recording once a payment
 * actually completes.
 *
 * Two-sided enforcement: every coupon row has a matching LemonSqueezy
 * discount (see createPercentDiscount), so LS independently rejects an
 * expired or exhausted code even if a caller reaches checkout without
 * passing through `validateCoupon`.
 */

import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { isUniqueViolation } from '@/lib/db-errors';
import { logger } from '@/lib/observability';

export type CouponRejection = 'not_found' | 'expired' | 'usage_limit_reached' | 'already_redeemed';

export type ValidateCouponResult =
  | { ok: true; couponId: string; code: string; discountPercent: number }
  | { ok: false; reason: CouponRejection };

/**
 * Check a user-entered code. Codes are matched case-insensitively —
 * people type them off a poster or a tweet, and LemonSqueezy itself
 * treats codes case-insensitively at checkout.
 */
export async function validateCoupon(
  rawCode: string,
  userId: string,
): Promise<ValidateCouponResult> {
  const code = rawCode.trim();
  if (!code) return { ok: false, reason: 'not_found' };

  const coupon = await db.query.coupons.findFirst({
    where: sql`lower(${schema.coupons.code}) = lower(${code})`,
    columns: {
      id: true,
      code: true,
      discountPercent: true,
      expiresAt: true,
      usageLimit: true,
      usageCount: true,
    },
  });
  if (!coupon) return { ok: false, reason: 'not_found' };

  if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
    return { ok: false, reason: 'expired' };
  }
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return { ok: false, reason: 'usage_limit_reached' };
  }

  // One redemption per user — the same rule the (couponId, userId)
  // unique constraint enforces at write time.
  const existing = await db.query.couponRedemptions.findFirst({
    where: and(
      eq(schema.couponRedemptions.couponId, coupon.id),
      eq(schema.couponRedemptions.userId, userId),
    ),
    columns: { id: true },
  });
  if (existing) return { ok: false, reason: 'already_redeemed' };

  return {
    ok: true,
    couponId: coupon.id,
    code: coupon.code,
    discountPercent: coupon.discountPercent,
  };
}

/**
 * Record a completed redemption. Called from the billing webhook once
 * payment succeeds — creating a checkout is not a redemption, since the
 * user may never pay.
 *
 * Idempotent: webhooks are delivered more than once, so a replay must
 * not double-count. The (couponId, userId) unique constraint is what
 * makes that true — usageCount is only incremented when the insert
 * actually created a row, and the increment itself is conditional on
 * the limit so concurrent redemptions can't push past it.
 */
export async function recordCouponRedemption(couponId: string, userId: string): Promise<void> {
  try {
    await db.insert(schema.couponRedemptions).values({ couponId, userId });
  } catch (err) {
    if (isUniqueViolation(err)) return; // replayed webhook — already counted
    logger.warn(
      { err: (err as Error).message, couponId, userId },
      'coupon.redemption_insert_failed',
    );
    return;
  }

  // Conditional increment, mirroring referrals/claim: only bump while
  // still under the cap (or when there is no cap at all).
  await db
    .update(schema.coupons)
    .set({ usageCount: sql`${schema.coupons.usageCount} + 1` })
    .where(
      and(
        eq(schema.coupons.id, couponId),
        or(
          isNull(schema.coupons.usageLimit),
          lt(schema.coupons.usageCount, schema.coupons.usageLimit),
        ),
      ),
    );
}
