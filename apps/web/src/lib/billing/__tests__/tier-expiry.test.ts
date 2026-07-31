import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regression tests for the one-time "Job Hunt Pack" never expiring.
 *
 * handleOrderCreated writes a 90-day pack as status='active' +
 * cancelAtPeriodEnd=true + currentPeriodEnd=+90d. getUserTier only
 * consulted currentPeriodEnd for canceled/past_due, and nothing ever
 * moves a one-time order off 'active' (there's no LemonSqueezy
 * subscription behind it, so subscription_expired never fires) — so a
 * single ₪75/₪199 purchase granted the tier permanently.
 */

const findFirst = vi.hoisted(() => ({ sub: vi.fn(), user: vi.fn() }));

vi.mock('@/db', () => ({
  db: {
    query: {
      subscriptions: { findFirst: (...a: unknown[]) => findFirst.sub(...a) },
      users: { findFirst: (...a: unknown[]) => findFirst.user(...a) },
    },
  },
  schema: { subscriptions: { userId: 'user_id' }, users: { id: 'id' } },
}));

const { getUserTier } = await import('../tier');

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.user.mockResolvedValue({ role: 'user' });
});

describe('getUserTier — non-renewing grant expiry', () => {
  it('downgrades a lapsed one-time pack (active + cancelAtPeriodEnd + past period end)', async () => {
    findFirst.sub.mockResolvedValue({
      tier: 'pro',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() - 110 * DAY),
      cancelAtPeriodEnd: true,
    });
    expect(await getUserTier('u1')).toBe('free');
  });

  it('still honours a one-time pack inside its window', async () => {
    findFirst.sub.mockResolvedValue({
      tier: 'pro',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * DAY),
      cancelAtPeriodEnd: true,
    });
    expect(await getUserTier('u1')).toBe('pro');
  });

  it('does NOT downgrade a healthy recurring sub whose renewal webhook is late', async () => {
    // currentPeriodEnd is the NEXT billing date for a recurring sub, so a
    // delayed/retried renewal webhook can leave it briefly in the past.
    // Revoking access someone is actively paying for would be a worse
    // failure than the bug this guards, hence the cancelAtPeriodEnd scope.
    findFirst.sub.mockResolvedValue({
      tier: 'plus',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() - 2 * DAY),
      cancelAtPeriodEnd: false,
    });
    expect(await getUserTier('u1')).toBe('plus');
  });

  it('keeps the existing canceled-with-grace behaviour', async () => {
    findFirst.sub.mockResolvedValue({
      tier: 'plus',
      status: 'canceled',
      currentPeriodEnd: new Date(Date.now() + 5 * DAY),
      cancelAtPeriodEnd: true,
    });
    expect(await getUserTier('u1')).toBe('plus');
  });

  it('admin override still wins over an expired pack', async () => {
    findFirst.user.mockResolvedValue({ role: 'admin' });
    findFirst.sub.mockResolvedValue({
      tier: 'free',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() - 400 * DAY),
      cancelAtPeriodEnd: true,
    });
    expect(await getUserTier('u1')).toBe('pro');
  });
});
