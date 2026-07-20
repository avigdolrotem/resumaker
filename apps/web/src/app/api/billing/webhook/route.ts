/**
 * POST /api/billing/webhook — Stripe webhook handler
 *
 * Dormant unless PAYMENT_PROVIDER='stripe'. Returns 503 cleanly when
 * off so Stripe's webhook UI shows a useful error instead of a 500.
 *
 * Idempotency: every event id is recorded in stripe_webhook_events
 * AFTER the handler succeeds. A retry hits the unique-key violation
 * and short-circuits — but a crash mid-handler leaves NO record, so
 * the next delivery actually re-processes (correct behavior).
 *
 * Handled events:
 *   - checkout.session.completed     → upgrade tier
 *   - customer.subscription.updated  → sync tier/status
 *   - customer.subscription.deleted  → downgrade to free at period end
 *   - invoice.payment_failed         → mark past_due
 */

import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { db, schema } from '@/db';
import { env } from '@/lib/env';
import {
  constructWebhookEvent,
  getStripe,
  resolvePriceId,
  getPeriodEndUnix,
} from '@/lib/billing/stripe';
import { syncSubscriptionFromStripe } from '@/lib/billing/provider';
import { logger } from '@/lib/observability';
import { auditEvent } from '@/lib/audit';
import { isUniqueViolation } from '@/lib/db-errors';
import { markReferralQualifiedIfPending } from '@/lib/referrals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  if (env.PAYMENT_PROVIDER !== 'stripe') {
    return NextResponse.json(
      { error: 'Stripe is not the active provider', code: 'PROVIDER_INACTIVE' },
      { status: 503 },
    );
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'stripe.webhook.signature_invalid');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Idempotency pre-check (cheap read-only). If we've already processed
  // this event id with success=true, short-circuit. Don't reserve the
  // row up-front — that would mark partial-failure as "done".
  const existing = await db.query.stripeWebhookEvents.findFirst({
    where: eq(schema.stripeWebhookEvents.id, event.id),
    columns: { success: true },
  });
  if (existing?.success) {
    logger.info({ eventId: event.id }, 'stripe.webhook.duplicate_skipped');
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Run handler first. Only record the event row after we know what
  // happened — that way a crash leaves no row and Stripe's retry will
  // genuinely re-process instead of being suppressed as a duplicate.
  let handlerError: Error | null = null;
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        await handleSubscriptionUpdate(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        logger.debug({ type: event.type }, 'stripe.webhook.unhandled_event');
    }
  } catch (err) {
    handlerError = err as Error;
  }

  // Record the event — `success` reflects the actual outcome.
  // Insert with ON CONFLICT to handle the rare case where we re-process
  // a previously-failed event (existing row, success=false): update it.
  try {
    await db
      .insert(schema.stripeWebhookEvents)
      .values({
        id: event.id,
        type: event.type,
        payload: event.data.object as unknown as Record<string, unknown>,
        success: handlerError === null,
        error: handlerError?.message ?? null,
      })
      .onConflictDoUpdate({
        target: schema.stripeWebhookEvents.id,
        set: {
          success: handlerError === null,
          error: handlerError?.message ?? null,
          processedAt: new Date(),
        },
      });
  } catch (err) {
    if (!isUniqueViolation(err)) {
      logger.error(
        { err: (err as Error).message, eventId: event.id },
        'stripe.webhook.event_record_failed',
      );
    }
  }

  if (handlerError) {
    logger.error(
      { err: handlerError.message, eventId: event.id, type: event.type },
      'stripe.webhook.handler_failed',
    );
    // 500 so Stripe retries
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ─── HANDLERS ───────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  if (!userId) {
    logger.warn({ sessionId: session.id }, 'stripe.checkout.missing_user_id');
    return;
  }

  // Every successful checkout is this user's first payment or a plan
  // change — either way, if they were referred, this is the "friend
  // subscribed" moment the referral page promises a reward for. No-ops
  // for the vast majority who weren't referred.
  await markReferralQualifiedIfPending(userId);

  // Subscription mode → tier comes from the subscription
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  if (subscriptionId) {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    await syncSubscriptionFromStripe(userId, sub);
    return;
  }

  // Payment mode (one-time purchase — Job Hunt Pack) → grant 90 days
  if (session.mode === 'payment') {
    const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 1 });
    const priceId = lineItems.data[0]?.price?.id;
    if (!priceId) {
      logger.warn({ sessionId: session.id }, 'stripe.checkout.one_time_no_price');
      return;
    }
    const resolved = resolvePriceId(priceId);
    if (!resolved || resolved.interval !== 'quarterly') {
      logger.warn({ priceId, sessionId: session.id }, 'stripe.checkout.unknown_one_time_price');
      return;
    }
    const customerId =
      typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null);
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    await db
      .insert(schema.subscriptions)
      .values({
        userId,
        provider: 'stripe',
        tier: resolved.tier,
        status: 'active',
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        currentPeriodEnd: expiresAt,
        cancelAtPeriodEnd: true, // one-time = won't renew
      })
      .onConflictDoUpdate({
        target: schema.subscriptions.userId,
        set: {
          provider: 'stripe',
          tier: resolved.tier,
          status: 'active',
          stripeCustomerId: customerId,
          stripePriceId: priceId,
          currentPeriodEnd: expiresAt,
          cancelAtPeriodEnd: true,
          updatedAt: new Date(),
        },
      });

    auditEvent({
      userId,
      event: 'billing_subscription_created',
      metadata: {
        provider: 'stripe',
        tier: resolved.tier,
        interval: 'quarterly',
        oneTime: true,
        expiresAt: expiresAt.toISOString(),
      },
    });
  }
}

async function handleSubscriptionUpdate(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const userId = await findUserIdByCustomer(customerId);
  if (!userId) {
    logger.warn({ customerId, subId: sub.id }, 'stripe.subscription.no_user_match');
    return;
  }
  await syncSubscriptionFromStripe(userId, sub);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const userId = await findUserIdByCustomer(customerId);
  if (!userId) return;

  // Prefer the top-level current_period_end (Stripe API 2024+) over the
  // per-item field, which moved off the item object. Fallback chain
  // keeps us safe across API versions.
  const periodEndUnix = getPeriodEndUnix(sub) ?? Math.floor(Date.now() / 1000);

  await db
    .update(schema.subscriptions)
    .set({
      provider: 'stripe',
      status: 'canceled',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date(periodEndUnix * 1000),
      updatedAt: new Date(),
    })
    .where(eq(schema.subscriptions.userId, userId));

  auditEvent({
    userId,
    event: 'billing_subscription_canceled',
    metadata: { stripeSubscriptionId: sub.id, periodEnd: periodEndUnix },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const userId = await findUserIdByCustomer(customerId);
  if (!userId) return;

  await db
    .update(schema.subscriptions)
    .set({ status: 'past_due', updatedAt: new Date() })
    .where(eq(schema.subscriptions.userId, userId));

  auditEvent({
    userId,
    event: 'billing_payment_failed',
    metadata: { stripeInvoiceId: invoice.id, amount: invoice.amount_due },
  });
}

async function findUserIdByCustomer(customerId: string): Promise<string | null> {
  const row = await db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.stripeCustomerId, customerId),
    columns: { userId: true },
  });
  return row?.userId ?? null;
}
