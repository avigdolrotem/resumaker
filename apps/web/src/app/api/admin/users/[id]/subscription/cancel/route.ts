/**
 * POST /api/admin/users/[id]/subscription/cancel
 *
 * Admin-only. Cancels a user's Stripe or LemonSqueezy subscription
 * at period end. Updates local subscription row.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth-guards';
import { getStripe } from '@/lib/billing/stripe';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id: targetUserId } = await params;

  const sub = await db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.userId, targetUserId),
  });
  if (!sub) return NextResponse.json({ error: 'No subscription found' }, { status: 404 });

  try {
    if (sub.provider === 'stripe' && sub.stripeSubscriptionId) {
      const stripe = getStripe();
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } else if (sub.provider === 'lemonsqueezy' && sub.lsSubscriptionId) {
      const { cancelSubscription } = await import('@lemonsqueezy/lemonsqueezy.js');
      const { ensureLemonSqueezy } = await import('@/lib/billing/lemonsqueezy');
      ensureLemonSqueezy();
      await cancelSubscription(sub.lsSubscriptionId);
    }
    // 'manual' subscriptions: just update locally
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to cancel with provider', detail: (err as Error).message },
      { status: 502 },
    );
  }

  await db
    .update(schema.subscriptions)
    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(eq(schema.subscriptions.userId, targetUserId));

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'subscription_cancel', targetUserId, provider: sub.provider },
  });

  return NextResponse.json({ success: true });
}
