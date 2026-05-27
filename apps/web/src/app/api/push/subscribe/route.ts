/**
 * POST /api/push/subscribe   — store a browser push subscription
 * DELETE /api/push/subscribe — remove by endpoint
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';

export const runtime = 'nodejs';

const SubscribeBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const UnsubscribeBody = z.object({
  endpoint: z.string().url(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  let body: z.infer<typeof SubscribeBody>;
  try {
    body = SubscribeBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 });
  }

  // Upsert — dedupe by endpoint
  await db
    .insert(schema.pushSubscriptions)
    .values({
      userId: guard.user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: {
        userId: guard.user.id,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
    });

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  let body: z.infer<typeof UnsubscribeBody>;
  try {
    body = UnsubscribeBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  await db
    .delete(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.endpoint, body.endpoint),
        eq(schema.pushSubscriptions.userId, guard.user.id),
      ),
    );

  return NextResponse.json({ success: true });
}
