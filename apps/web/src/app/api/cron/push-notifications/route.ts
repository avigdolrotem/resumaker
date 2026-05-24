/**
 * GET /api/cron/push-notifications
 *
 * Bearer-protected cron. Iterates push_subscriptions for users who have
 * unread notifications and sends a push digest.
 *
 * Requires VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT env vars.
 * Skips with a logged warning if VAPID keys are not configured.
 *
 * NOTE: Vercel Cron sends GET, so this MUST be exported as GET.
 * The route previously exported POST and never fired in production.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { isNull, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/observability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get('authorization');
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

  // Find all users with unread notifications
  const unreadRows = await db.query.notifications.findMany({
    where: isNull(schema.notifications.readAt),
    columns: { userId: true, title: true, body: true, link: true },
    limit: 500,
  });

  if (unreadRows.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Group by userId
  const byUser = new Map<string, typeof unreadRows>();
  for (const row of unreadRows) {
    const existing = byUser.get(row.userId) ?? [];
    existing.push(row);
    byUser.set(row.userId, existing);
  }

  let sent = 0;
  let failed = 0;

  for (const [userId, notifs] of byUser) {
    const subscriptions = await db.query.pushSubscriptions.findMany({
      where: eq(schema.pushSubscriptions.userId, userId),
    });

    if (subscriptions.length === 0) continue;

    const payload = JSON.stringify({
      title: `Resumaker — ${notifs.length} notification${notifs.length > 1 ? 's' : ''}`,
      body: notifs[0]?.title ?? 'You have new activity',
      url: notifs[0]?.link ?? '/he/dashboard',
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        failed++;
        logger.error({ err: (err as Error).message, endpoint: sub.endpoint }, 'push.send_failed');
        // If subscription is gone (410), remove it
        if ((err as { statusCode?: number }).statusCode === 410) {
          await db
            .delete(schema.pushSubscriptions)
            .where(eq(schema.pushSubscriptions.endpoint, sub.endpoint));
        }
      }
    }
  }

  return NextResponse.json({ sent, failed, usersProcessed: byUser.size });
}
