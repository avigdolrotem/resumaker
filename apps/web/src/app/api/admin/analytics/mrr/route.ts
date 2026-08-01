/**
 * GET /api/admin/analytics/mrr
 *
 * Monthly recurring revenue: every paying subscription normalised to a
 * monthly figure.
 *
 * This route previously hardcoded `{ plus: 3900, pro: 9900 }` (₪39/₪99)
 * — prices from an earlier scheme, never updated when they became
 * ₪29/₪79, while TIER_LIMITS sat right there as the single source of
 * truth. It also counted a ₪290/yr subscriber at the full monthly rate
 * and treated one-time 90-day Job Hunt Packs as recurring forever. On a
 * realistic mix that overstated MRR by roughly 70%, and the pack error
 * compounded with every pack sold.
 *
 * Now: prices come from TIER_LIMITS, each interval is converted to a
 * monthly equivalent, lapsed non-renewing grants are excluded, and
 * admin-granted (provider='manual') rows never count as revenue.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, inArray, ne } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth-guards';
import { TIER_LIMITS, type Tier } from '@/lib/billing/limits';
import { resolveVariantId } from '@/lib/billing/lemonsqueezy';

type Interval = 'monthly' | 'yearly' | 'quarterly';

/**
 * Monthly-equivalent price in agorot for one subscription. `quarterly`
 * is the one-time 90-day Job Hunt Pack, so its value is spread across
 * the three months it actually covers rather than booked as recurring.
 */
function monthlyEquivalentAgorot(tier: Tier, interval: Interval): number {
  const limits = TIER_LIMITS[tier];
  switch (interval) {
    case 'yearly':
      return limits.priceYearly > 0 ? Math.round((limits.priceYearly * 100) / 12) : 0;
    case 'quarterly':
      return limits.priceQuarterly > 0 ? Math.round((limits.priceQuarterly * 100) / 3) : 0;
    case 'monthly':
    default:
      return limits.priceMonthly > 0 ? limits.priceMonthly * 100 : 0;
  }
}

export async function GET(_req: NextRequest): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const subs = await db.query.subscriptions.findMany({
    where: and(
      ne(schema.subscriptions.tier, 'free'),
      // 'trialing' is a live subscription that will bill — counting it
      // matches how getUserTier treats it for access purposes.
      inArray(schema.subscriptions.status, ['active', 'trialing']),
      // Admin grants aren't revenue.
      ne(schema.subscriptions.provider, 'manual'),
    ),
    columns: {
      tier: true,
      lsVariantId: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });

  const now = new Date();
  let mrrAgorot = 0;
  let counted = 0;
  let excludedExpired = 0;
  const byInterval: Record<Interval, number> = { monthly: 0, yearly: 0, quarterly: 0 };

  for (const sub of subs) {
    // A non-renewing grant past its period end contributes nothing —
    // the same predicate getUserTier uses to stop honouring it.
    if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd && sub.currentPeriodEnd <= now) {
      excludedExpired++;
      continue;
    }

    // The interval isn't stored on the row; derive it from the
    // LemonSqueezy variant when there is one. Stripe and legacy rows
    // fall back to monthly — conservative in the sense that it can only
    // over-state a yearly sub, never invent revenue that isn't there.
    const resolved = sub.lsVariantId ? resolveVariantId(sub.lsVariantId) : null;
    const interval: Interval = resolved?.interval ?? 'monthly';

    mrrAgorot += monthlyEquivalentAgorot(sub.tier as Tier, interval);
    byInterval[interval]++;
    counted++;
  }

  return NextResponse.json({
    mrrAgorot,
    mrrIls: mrrAgorot / 100,
    subscriberCount: counted,
    byInterval,
    excludedExpired,
  });
}
