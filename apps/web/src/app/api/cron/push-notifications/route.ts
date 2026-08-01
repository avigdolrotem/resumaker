/**
 * GET /api/cron/push-notifications
 *
 * Bearer-protected cron. Sends one push digest per user covering their
 * unread, not-yet-pushed notifications.
 *
 * Requires VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT env vars.
 * Skips with a logged warning if VAPID keys are not configured.
 *
 * Three things this used to get wrong, all fixed here:
 *   1. It ignored `notificationPrefs.pushAll`. That flag is settable in
 *      Settings and is explicitly set to false by /api/account/gdpr, so
 *      a user who opted out of push kept receiving it.
 *   2. It selected on `readAt IS NULL` with no record of what had
 *      already been sent, so every run re-pushed the same unread
 *      notification — a daily nag until the user happened to open it.
 *      `notifications.pushedAt` now marks them.
 *   3. `limit: 500` applied globally across all users with no ORDER BY,
 *      so past 500 unread rows system-wide an arbitrary subset of users
 *      was silently starved. Now ordered oldest-first and bounded by
 *      users-per-run, so the backlog drains deterministically.
 *
 * NOTE: Vercel Cron sends GET, so this MUST be exported as GET.
 * The route previously exported POST and never fired in production.
 */

import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/observability';
import { verifyCronSecret } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Users handled per run. Bounds runtime; the rest drain on the next tick. */
const MAX_USERS_PER_RUN = 200;

export async function GET(req: NextRequest): Promise<Response> {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    logger.warn({}, 'push-notifications.vapid_keys_missing — skipping');
    return NextResponse.json({ skipped: true, reason: 'VAPID keys not configured' });
  }

  const webpush = await import('web-push');
  webpush.setVapidDetails(
    env.VAPID_SUBJECT ?? `mailto:${env.EMAIL_FROM}`,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );

  // Unread + never-pushed, oldest first, only for users who haven't
  // opted out. An absent pushAll means opted-in, matching the
  // notificationPrefs default documented on the users table.
  const pending = await db
    .select({
      id: schema.notifications.id,
      userId: schema.notifications.userId,
      title: schema.notifications.title,
      link: schema.notifications.link,
      locale: schema.users.locale,
    })
    .from(schema.notifications)
    .innerJoin(schema.users, eq(schema.users.id, schema.notifications.userId))
    .where(
      and(
        isNull(schema.notifications.readAt),
        isNull(schema.notifications.pushedAt),
        isNull(schema.users.deletedAt),
        sql`COALESCE((${schema.users.notificationPrefs}->>'pushAll')::boolean, true) = true`,
      ),
    )
    .orderBy(asc(schema.notifications.createdAt))
    .limit(1000);

  if (pending.length === 0) {
    return NextResponse.json({ sent: 0, usersProcessed: 0 });
  }

  const byUser = new Map<string, typeof pending>();
  for (const row of pending) {
    if (!byUser.has(row.userId) && byUser.size >= MAX_USERS_PER_RUN) continue;
    const existing = byUser.get(row.userId) ?? [];
    existing.push(row);
    byUser.set(row.userId, existing);
  }

  // One query for every subscription we might need, rather than one per
  // user inside the loop.
  const userIds = [...byUser.keys()];
  const allSubs = await db.query.pushSubscriptions.findMany({
    where: inArray(schema.pushSubscriptions.userId, userIds),
  });
  const subsByUser = new Map<string, typeof allSubs>();
  for (const sub of allSubs) {
    const existing = subsByUser.get(sub.userId) ?? [];
    existing.push(sub);
    subsByUser.set(sub.userId, existing);
  }

  let sent = 0;
  let failed = 0;
  const pushedIds: string[] = [];

  for (const [userId, notifs] of byUser) {
    const subscriptions = subsByUser.get(userId) ?? [];
    // No devices registered — mark them pushed anyway so they don't
    // re-scan forever; the in-app notification list is unaffected.
    if (subscriptions.length === 0) {
      pushedIds.push(...notifs.map((n) => n.id));
      continue;
    }

    const first = notifs[0];
    const locale = first?.locale === 'en' ? 'en' : 'he';
    const payload = JSON.stringify({
      title: `Resumaker — ${notifs.length} notification${notifs.length > 1 ? 's' : ''}`,
      body: first?.title ?? 'You have new activity',
      // Fall back to the recipient's own locale rather than a hardcoded
      // /he/dashboard, which deep-linked English users into Hebrew.
      url: first?.link ?? `/${locale}/dashboard`,
    });

    let deliveredToAny = false;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
        deliveredToAny = true;
      } catch (err) {
        failed++;
        // Endpoint URL is a long unique identifier that can correlate
        // a subscriber across services — hash before logging.
        const endpointHash = createHash('sha256').update(sub.endpoint).digest('hex').slice(0, 16);
        logger.error({ err: (err as Error).name, endpointHash }, 'push.send_failed');
        // If subscription is gone (410), remove it
        if ((err as { statusCode?: number }).statusCode === 410) {
          await db
            .delete(schema.pushSubscriptions)
            .where(eq(schema.pushSubscriptions.endpoint, sub.endpoint));
        }
      }
    }

    // Only mark on a successful delivery — a total failure (all
    // endpoints down) should be retried next run, not silently dropped.
    if (deliveredToAny) {
      pushedIds.push(...notifs.map((n) => n.id));
    }
  }

  if (pushedIds.length > 0) {
    await db
      .update(schema.notifications)
      .set({ pushedAt: new Date() })
      .where(inArray(schema.notifications.id, pushedIds));
  }

  return NextResponse.json({
    sent,
    failed,
    usersProcessed: byUser.size,
    notificationsMarked: pushedIds.length,
  });
}
