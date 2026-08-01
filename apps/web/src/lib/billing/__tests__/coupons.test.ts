import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Coupon validation is money-adjacent: a wrong `true` here hands out a
 * discount that was expired, exhausted, or already used by this person.
 * Each rejection reason is asserted separately so a future refactor
 * can't collapse them into a generic "invalid".
 */

const q = vi.hoisted(() => ({ coupon: vi.fn(), redemption: vi.fn() }));

vi.mock('@/db', () => ({
  db: {
    query: {
      coupons: { findFirst: (...a: unknown[]) => q.coupon(...a) },
      couponRedemptions: { findFirst: (...a: unknown[]) => q.redemption(...a) },
    },
  },
  schema: {
    coupons: { code: 'code', id: 'id', usageCount: 'usage_count', usageLimit: 'usage_limit' },
    couponRedemptions: { couponId: 'coupon_id', userId: 'user_id' },
  },
}));

const { validateCoupon } = await import('../coupons');

const DAY = 24 * 60 * 60 * 1000;
const base = {
  id: 'c1',
  code: 'SAVE20',
  discountPercent: 20,
  expiresAt: null as Date | null,
  usageLimit: null as number | null,
  usageCount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  q.redemption.mockResolvedValue(undefined); // not yet redeemed by this user
});

describe('validateCoupon', () => {
  it('accepts a live coupon and returns its percentage', async () => {
    q.coupon.mockResolvedValue({ ...base });
    const r = await validateCoupon('SAVE20', 'u1');
    expect(r).toEqual({ ok: true, couponId: 'c1', code: 'SAVE20', discountPercent: 20 });
  });

  it('rejects an unknown code', async () => {
    q.coupon.mockResolvedValue(undefined);
    expect(await validateCoupon('NOPE', 'u1')).toEqual({ ok: false, reason: 'not_found' });
  });

  it('rejects an empty/whitespace code without hitting the db', async () => {
    expect(await validateCoupon('   ', 'u1')).toEqual({ ok: false, reason: 'not_found' });
    expect(q.coupon).not.toHaveBeenCalled();
  });

  it('rejects an expired coupon', async () => {
    q.coupon.mockResolvedValue({ ...base, expiresAt: new Date(Date.now() - DAY) });
    expect(await validateCoupon('SAVE20', 'u1')).toEqual({ ok: false, reason: 'expired' });
  });

  it('accepts one that expires in the future', async () => {
    q.coupon.mockResolvedValue({ ...base, expiresAt: new Date(Date.now() + DAY) });
    expect((await validateCoupon('SAVE20', 'u1')).ok).toBe(true);
  });

  it('rejects once the usage limit is reached', async () => {
    q.coupon.mockResolvedValue({ ...base, usageLimit: 5, usageCount: 5 });
    expect(await validateCoupon('SAVE20', 'u1')).toEqual({
      ok: false,
      reason: 'usage_limit_reached',
    });
  });

  it('accepts while still under the limit, and treats a null limit as unlimited', async () => {
    q.coupon.mockResolvedValue({ ...base, usageLimit: 5, usageCount: 4 });
    expect((await validateCoupon('SAVE20', 'u1')).ok).toBe(true);
    q.coupon.mockResolvedValue({ ...base, usageLimit: null, usageCount: 9999 });
    expect((await validateCoupon('SAVE20', 'u1')).ok).toBe(true);
  });

  it('rejects a second use by the same user', async () => {
    q.coupon.mockResolvedValue({ ...base });
    q.redemption.mockResolvedValue({ id: 'r1' });
    expect(await validateCoupon('SAVE20', 'u1')).toEqual({ ok: false, reason: 'already_redeemed' });
  });

  it('returns the canonical stored code, not the caller casing', async () => {
    q.coupon.mockResolvedValue({ ...base });
    const r = await validateCoupon('  save20  ', 'u1');
    expect(r.ok && r.code).toBe('SAVE20');
  });
});
