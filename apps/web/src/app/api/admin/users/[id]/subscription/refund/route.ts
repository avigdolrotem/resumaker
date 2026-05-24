/**
 * POST /api/admin/users/[id]/subscription/refund
 *
 * Body: { amountCents: number, reason?: string }
 *
 * Issues a refund via Stripe or LemonSqueezy based on the subscription's provider.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth-guards';
import { getStripe } from '@/lib/billing/stripe';

const BodySchema = z.object({
  amountCents: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id: targetUserId } = await params;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const sub = await db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.userId, targetUserId),
  });
  if (!sub) return NextResponse.json({ error: 'No subscription found' }, { status: 404 });

  let refundId: string | undefined;

  try {
    if (sub.provider === 'stripe') {
      const stripe = getStripe();
      if (!sub.stripeSubscriptionId) {
        return NextResponse.json({ error: 'No Stripe subscription ID found' }, { status: 400 });
      }
      // Get the latest charge for this subscription
      const invoices = await stripe.invoices.list({
        subscription: sub.stripeSubscriptionId,
        limit: 1,
      });
      const invoice = invoices.data[0];
      const paymentIntentId =
        invoice &&
        typeof (invoice as unknown as { payment_intent?: unknown }).payment_intent === 'string'
          ? (invoice as unknown as { payment_intent: string }).payment_intent
          : null;
      if (!paymentIntentId) {
        return NextResponse.json({ error: 'No payment found to refund' }, { status: 404 });
      }
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: body.amountCents,
        reason: 'requested_by_customer',
      });
      refundId = refund.id;
    } else if (sub.provider === 'lemonsqueezy') {
      // LemonSqueezy refunds via their API (order-level)
      return NextResponse.json(
        { error: 'LemonSqueezy refunds must be issued via dashboard for now' },
        { status: 501 },
      );
    } else {
      return NextResponse.json(
        { error: 'Manual subscriptions have no payment to refund' },
        { status: 400 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: 'Refund failed', detail: (err as Error).message },
      { status: 502 },
    );
  }

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: {
      kind: 'subscription_refund',
      targetUserId,
      amountCents: body.amountCents,
      reason: body.reason,
      refundId,
    },
  });

  return NextResponse.json({ success: true, refundId });
}
