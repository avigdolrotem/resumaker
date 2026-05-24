/**
 * GET /api/admin/analytics/mrr
 *
 * Returns MRR (monthly recurring revenue) by summing tier prices
 * across active subscriptions.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, eq, ne } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth-guards';

// Approximate tier prices in ILS (agorot = cents)
const TIER_PRICE_ILS: Record<string, number> = {
  plus: 3900, // ₪39
  pro: 9900,  // ₪99
};

export async function GET(_req: NextRequest): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const activeSubs = await db.query.subscriptions.findMany({
    where: and(
      ne(schema.subscriptions.tier, 'free'),
      eq(schema.subscriptions.status, 'active'),
    ),
    columns: { tier: true },
  });

  const mrrAgorot = activeSubs.reduce((sum, sub) => {
    return sum + (TIER_PRICE_ILS[sub.tier] ?? 0);
  }, 0);

  return NextResponse.json({
    mrrAgorot,
    mrrIls: mrrAgorot / 100,
    subscriberCount: activeSubs.length,
  });
}
