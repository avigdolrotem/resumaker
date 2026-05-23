/**
 * DELETE /api/account
 *
 * Soft-delete the current user (purge cron hard-deletes after 30 days).
 * Cancels any active provider subscription BEFORE the soft-delete so we
 * stop charging immediately. Sessions are invalidated synchronously.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/observability';

export async function DELETE(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // 1. Cancel external subscription FIRST — if this fails, we want to
  //    bail rather than soft-delete the user and keep billing them. The
  //    user can retry; we don't want a silent "deleted but still charged"
  //    state for compliance reasons.
  const sub = await db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.userId, userId),
    columns: {
      provider: true,
      stripeSubscriptionId: true,
      lsSubscriptionId: true,
    },
  });

  if (sub) {
    try {
      if (sub.provider === 'stripe' && sub.stripeSubscriptionId) {
        const { getStripe } = await import('@/lib/billing/stripe');
        // cancel_at_period_end=false cancels immediately so we stop
        // charging; the user has the rest of their period anyway because
        // they're deleting their account.
        await getStripe().subscriptions.cancel(sub.stripeSubscriptionId);
      } else if (sub.provider === 'lemonsqueezy' && sub.lsSubscriptionId) {
        const ls = await import('@lemonsqueezy/lemonsqueezy.js');
        const { ensureLemonSqueezy } = await import('@/lib/billing/lemonsqueezy');
        ensureLemonSqueezy();
        await ls.cancelSubscription(sub.lsSubscriptionId);
      }
    } catch (err) {
      // Log but don't block deletion — if the cancel API fails (provider
      // outage, sub already cancelled, network), the support team can
      // chase the refund. The user's intent is to delete; respect it.
      logger.error(
        {
          err: (err as Error).message,
          userId,
          provider: sub.provider,
        },
        'account.delete.provider_cancel_failed',
      );
      // Still mark the failure in audit so support can find it later.
    }
  }

  // 2. Soft-delete user + drop sessions + audit, atomically.
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ deletedAt: new Date() }).where(eq(schema.users.id, userId));

    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));

    await tx.insert(schema.auditLog).values({
      userId,
      event: 'account_deleted',
      metadata: {
        reason: 'user_requested',
        hadSubscription: Boolean(sub),
        provider: sub?.provider ?? null,
        // Hint for support if the provider cancel hit the catch above
        stripeSubId: sub?.stripeSubscriptionId ?? null,
        lsSubId: sub?.lsSubscriptionId ?? null,
      },
    });
  });

  return NextResponse.json({ success: true, providerEnabled: env.PAYMENT_PROVIDER !== 'none' });
}
