/**
 * POST /api/billing/webhook/lemonsqueezy — LemonSqueezy webhook handler.
 *
 * Dormant unless `PAYMENT_PROVIDER='lemonsqueezy'` AND the webhook
 * secret is configured. Returns 503 when off so misconfigured webhooks
 * in the LS dashboard fail visibly.
 *
 * Handled events:
 *   - order_created            → first checkout success; if 90-day pack, grant tier
 *   - subscription_created     → new sub starts (set tier+status)
 *   - subscription_updated     → plan changed / renewed
 *   - subscription_cancelled   → grace period until current_period_end
 *   - subscription_expired     → access ends, downgrade to free
 *   - subscription_resumed     → reactivated
 *   - subscription_payment_failed → mark past_due
 *
 * Idempotency: sha256 of raw body is the event id. The row is written
 * AFTER the handler runs (insert-on-success, update-on-replay) so a
 * crash leaves no row and the next retry actually re-processes.
 */

import { createHash } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { env } from '@/lib/env';
import { auditEvent } from '@/lib/audit';
import { logger } from '@/lib/observability';
import { isUniqueViolation } from '@/lib/db-errors';
import { verifyWebhookSignature, resolveVariantId, mapLsStatus } from '@/lib/billing/lemonsqueezy';
import { JOB_HUNT_PACK_DURATION_DAYS } from '@/lib/billing/limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LsWebhookPayload {
  meta: {
    event_name: string;
    /** LS allows arbitrary JSON per docs; tighten at the key read site. */
    custom_data?: Record<string, unknown> | null;
  };
  data: {
    id: string;
    type: string;
    attributes: Record<string, unknown>;
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  if (env.PAYMENT_PROVIDER !== 'lemonsqueezy') {
    return NextResponse.json(
      { error: 'LemonSqueezy is not the active provider', code: 'PROVIDER_INACTIVE' },
      { status: 503 },
    );
  }

  const signature = req.headers.get('x-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing X-Signature header' }, { status: 400 });
  }

  const rawBody = await req.text();

  let valid = false;
  try {
    valid = verifyWebhookSignature(rawBody, signature);
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'lemonsqueezy.webhook.verify_threw');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }
  if (!valid) {
    logger.warn({}, 'lemonsqueezy.webhook.signature_invalid');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let payload: LsWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as LsWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const eventId = createHash('sha256').update(rawBody).digest('hex').slice(0, 64);
  const eventName = payload.meta.event_name;

  // Idempotency pre-check (don't reserve the row yet).
  const existing = await db.query.lsWebhookEvents.findFirst({
    where: eq(schema.lsWebhookEvents.id, eventId),
    columns: { success: true },
  });
  if (existing?.success) {
    logger.info({ eventId, eventName }, 'lemonsqueezy.webhook.duplicate_skipped');
    return NextResponse.json({ received: true, duplicate: true });
  }

  let handlerError: Error | null = null;
  try {
    switch (eventName) {
      case 'order_created':
        await handleOrderCreated(payload);
        break;
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_resumed':
        await handleSubscriptionUpsert(payload);
        break;
      case 'subscription_cancelled':
        await handleSubscriptionCancelled(payload);
        break;
      case 'subscription_expired':
        await handleSubscriptionExpired(payload);
        break;
      case 'subscription_payment_failed':
        await handlePaymentFailed(payload);
        break;
      default:
        logger.debug({ eventName }, 'lemonsqueezy.webhook.unhandled_event');
    }
  } catch (err) {
    handlerError = err as Error;
  }

  // Record outcome (insert or update an existing failed-attempt row).
  try {
    await db
      .insert(schema.lsWebhookEvents)
      .values({
        id: eventId,
        eventName,
        payload: payload as unknown as Record<string, unknown>,
        success: handlerError === null,
        error: handlerError?.message ?? null,
      })
      .onConflictDoUpdate({
        target: schema.lsWebhookEvents.id,
        set: {
          success: handlerError === null,
          error: handlerError?.message ?? null,
          processedAt: new Date(),
        },
      });
  } catch (err) {
    if (!isUniqueViolation(err)) {
      logger.error(
        { err: (err as Error).message, eventId },
        'lemonsqueezy.webhook.event_record_failed',
      );
    }
  }

  if (handlerError) {
    logger.error(
      { err: handlerError.message, eventId, eventName },
      'lemonsqueezy.webhook.handler_failed',
    );
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ─── HANDLERS ───────────────────────────────────────────────────────

/** Read `user_id` from `meta.custom_data` defensively (LS allows arbitrary JSON). */
function getUserIdFromCustomData(payload: LsWebhookPayload): string | null {
  const v = payload.meta.custom_data?.['user_id'];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Locate the resumaker user behind a webhook event. Tries `custom_data.user_id`
 * first (set by our checkout flow) and falls back to looking up by lsCustomerId.
 */
async function resolveWebhookUserId(
  payload: LsWebhookPayload,
  customerId: string | null,
): Promise<string | null> {
  const fromCustom = getUserIdFromCustomData(payload);
  if (fromCustom) return fromCustom;
  if (!customerId) return null;
  const row = await db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.lsCustomerId, customerId),
    columns: { userId: true },
  });
  return row?.userId ?? null;
}

async function handleOrderCreated(payload: LsWebhookPayload): Promise<void> {
  const attrs = payload.data.attributes as {
    customer_id?: number | string;
    first_order_item?: { variant_id?: number | string };
    /** LS sets `subscription_id` on orders that started a recurring subscription. */
    subscription_id?: number | string | null;
  };
  const customerId = attrs.customer_id ? String(attrs.customer_id) : null;
  const userId = await resolveWebhookUserId(payload, customerId);
  if (!userId) {
    logger.warn({ orderId: payload.data.id }, 'lemonsqueezy.order.missing_user_id_in_custom_data');
    return;
  }

  // If the order created a subscription, the `subscription_created` event
  // will handle the tier grant — don't double-process.
  if (attrs.subscription_id) {
    await db
      .insert(schema.subscriptions)
      .values({ userId, provider: 'lemonsqueezy', lsCustomerId: customerId })
      .onConflictDoUpdate({
        target: schema.subscriptions.userId,
        set: {
          provider: 'lemonsqueezy',
          lsCustomerId: customerId,
          updatedAt: new Date(),
        },
      });
    return;
  }

  // One-time purchase — likely the "Job Hunt Pack" (90 days). Grant the
  // tier mapped to the variant and set an expiry.
  const variantId = attrs.first_order_item?.variant_id
    ? String(attrs.first_order_item.variant_id)
    : null;
  if (!variantId) {
    logger.warn({ orderId: payload.data.id }, 'lemonsqueezy.order.no_variant_id');
    return;
  }

  const resolved = resolveVariantId(variantId);
  if (!resolved || resolved.interval !== 'quarterly') {
    logger.warn(
      { variantId, orderId: payload.data.id },
      'lemonsqueezy.order.unknown_or_non_quarterly_variant',
    );
    return;
  }

  const expiresAt = new Date(Date.now() + JOB_HUNT_PACK_DURATION_DAYS * 24 * 60 * 60 * 1000);
  await db
    .insert(schema.subscriptions)
    .values({
      userId,
      provider: 'lemonsqueezy',
      tier: resolved.tier,
      status: 'active',
      lsCustomerId: customerId,
      lsVariantId: variantId,
      currentPeriodEnd: expiresAt,
      cancelAtPeriodEnd: true, // one-time = won't renew
    })
    .onConflictDoUpdate({
      target: schema.subscriptions.userId,
      set: {
        provider: 'lemonsqueezy',
        tier: resolved.tier,
        status: 'active',
        lsCustomerId: customerId,
        lsVariantId: variantId,
        currentPeriodEnd: expiresAt,
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      },
    });

  auditEvent({
    userId,
    event: 'billing_subscription_created',
    metadata: {
      provider: 'lemonsqueezy',
      tier: resolved.tier,
      interval: 'quarterly',
      oneTime: true,
      expiresAt: expiresAt.toISOString(),
    },
  });
}

async function handleSubscriptionUpsert(payload: LsWebhookPayload): Promise<void> {
  const attrs = payload.data.attributes as {
    customer_id?: number | string;
    variant_id?: number | string;
    status?: string;
    cancelled?: boolean;
    renews_at?: string | null;
    ends_at?: string | null;
    trial_ends_at?: string | null;
    urls?: { customer_portal?: string };
  };

  const variantId = attrs.variant_id ? String(attrs.variant_id) : null;
  const customerId = attrs.customer_id ? String(attrs.customer_id) : null;
  const subscriptionId = payload.data.id;

  if (!variantId) {
    logger.warn({ subscriptionId }, 'lemonsqueezy.subscription.missing_variant');
    return;
  }

  const resolved = resolveVariantId(variantId);
  if (!resolved) {
    logger.warn({ variantId, subscriptionId }, 'lemonsqueezy.subscription.unknown_variant');
    return;
  }

  const resolvedUserId = await resolveWebhookUserId(payload, customerId);
  if (!resolvedUserId) {
    logger.warn({ subscriptionId }, 'lemonsqueezy.subscription.cannot_map_to_user');
    return;
  }

  const status = mapLsStatus(attrs.status ?? '');
  // LS uses `renews_at` for the next billing date when active, or `ends_at`
  // when cancelled/expired. Prefer the meaningful one.
  const periodEndStr = attrs.renews_at ?? attrs.ends_at ?? null;
  const currentPeriodEnd = periodEndStr ? new Date(periodEndStr) : null;

  await db
    .insert(schema.subscriptions)
    .values({
      userId: resolvedUserId,
      provider: 'lemonsqueezy',
      tier: resolved.tier,
      status,
      lsCustomerId: customerId,
      lsSubscriptionId: subscriptionId,
      lsVariantId: variantId,
      lsCustomerPortalUrl: attrs.urls?.customer_portal ?? null,
      currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(attrs.cancelled),
    })
    .onConflictDoUpdate({
      target: schema.subscriptions.userId,
      set: {
        provider: 'lemonsqueezy',
        tier: resolved.tier,
        status,
        lsCustomerId: customerId,
        lsSubscriptionId: subscriptionId,
        lsVariantId: variantId,
        lsCustomerPortalUrl: attrs.urls?.customer_portal ?? null,
        currentPeriodEnd,
        cancelAtPeriodEnd: Boolean(attrs.cancelled),
        updatedAt: new Date(),
      },
    });

  auditEvent({
    userId: resolvedUserId,
    event:
      payload.meta.event_name === 'subscription_created'
        ? 'billing_subscription_created'
        : 'billing_subscription_updated',
    metadata: {
      provider: 'lemonsqueezy',
      subscriptionId,
      tier: resolved.tier,
      interval: resolved.interval,
      status: attrs.status,
    },
  });
}

async function handleSubscriptionCancelled(payload: LsWebhookPayload): Promise<void> {
  const attrs = payload.data.attributes as {
    customer_id?: number | string;
    ends_at?: string | null;
  };
  const customerId = attrs.customer_id ? String(attrs.customer_id) : null;
  const userId = await resolveWebhookUserId(payload, customerId);
  if (!userId) return;

  await db
    .update(schema.subscriptions)
    .set({
      provider: 'lemonsqueezy',
      status: 'canceled',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: attrs.ends_at ? new Date(attrs.ends_at) : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.subscriptions.userId, userId));

  auditEvent({
    userId,
    event: 'billing_subscription_canceled',
    metadata: { provider: 'lemonsqueezy', subscriptionId: payload.data.id },
  });
}

async function handleSubscriptionExpired(payload: LsWebhookPayload): Promise<void> {
  const attrs = payload.data.attributes as { customer_id?: number | string };
  const customerId = attrs.customer_id ? String(attrs.customer_id) : null;
  const userId = await resolveWebhookUserId(payload, customerId);
  if (!userId) return;

  // Hard downgrade: access is over
  await db
    .update(schema.subscriptions)
    .set({
      tier: 'free',
      status: 'canceled',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.subscriptions.userId, userId));

  auditEvent({
    userId,
    event: 'billing_subscription_canceled',
    metadata: {
      provider: 'lemonsqueezy',
      subscriptionId: payload.data.id,
      reason: 'expired',
    },
  });
}

async function handlePaymentFailed(payload: LsWebhookPayload): Promise<void> {
  const attrs = payload.data.attributes as { customer_id?: number | string };
  const customerId = attrs.customer_id ? String(attrs.customer_id) : null;
  const userId = await resolveWebhookUserId(payload, customerId);
  if (!userId) return;

  await db
    .update(schema.subscriptions)
    .set({ status: 'past_due', updatedAt: new Date() })
    .where(eq(schema.subscriptions.userId, userId));

  auditEvent({
    userId,
    event: 'billing_payment_failed',
    metadata: { provider: 'lemonsqueezy', subscriptionId: payload.data.id },
  });
}
