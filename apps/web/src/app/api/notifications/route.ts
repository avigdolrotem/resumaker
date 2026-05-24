/**
 * GET   /api/notifications        — list current user's notifications (newest 30)
 * PATCH /api/notifications        — mark all as read (body: { markAllRead: true })
 *
 * Per-item read is via PATCH /api/notifications/[id].
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';

export async function GET(): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const rows = await db.query.notifications.findMany({
    where: eq(schema.notifications.userId, guard.user.id),
    orderBy: (n, { desc }) => [desc(n.createdAt)],
    limit: 30,
  });
  const unreadCount = rows.filter((r) => r.readAt === null).length;
  return NextResponse.json({ notifications: rows, unreadCount });
}

const PatchBody = z.object({
  markAllRead: z.literal(true).optional(),
});

export async function PATCH(req: NextRequest): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch {
    body = {};
  }

  if (body.markAllRead) {
    await db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(schema.notifications.userId, guard.user.id), isNull(schema.notifications.readAt)),
      );
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'No-op' }, { status: 400 });
}
