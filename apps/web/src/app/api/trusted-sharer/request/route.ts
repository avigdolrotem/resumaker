/**
 * GET  /api/trusted-sharer/request — caller's own request history + current trust status
 * POST /api/trusted-sharer/request — submit a new request (one pending at a time)
 *
 * See lib/content-trust.ts for what "trusted" unlocks (manual imports
 * publish immediately instead of landing as status='pending'). Reviewed
 * by an admin at /admin/moderation, not auto-approved by anything here.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';
import { isTrustedSharer } from '@/lib/content-trust';

export async function GET(): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const requests = await db.query.trustedSharerRequests.findMany({
    where: eq(schema.trustedSharerRequests.userId, guard.user.id),
    orderBy: desc(schema.trustedSharerRequests.createdAt),
  });

  return NextResponse.json({
    trusted: isTrustedSharer(guard.user),
    requests,
  });
}

const PostBody = z.object({
  note: z.string().min(20).max(1000),
});

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  if (isTrustedSharer(guard.user)) {
    return NextResponse.json({ error: 'Already trusted' }, { status: 409 });
  }

  const pending = await db.query.trustedSharerRequests.findFirst({
    where: and(
      eq(schema.trustedSharerRequests.userId, guard.user.id),
      eq(schema.trustedSharerRequests.status, 'pending'),
    ),
  });
  if (pending) {
    return NextResponse.json({ error: 'You already have a pending request' }, { status: 409 });
  }

  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(schema.trustedSharerRequests)
    .values({ userId: guard.user.id, note: body.note })
    .returning({ id: schema.trustedSharerRequests.id });

  return NextResponse.json({ id: row?.id }, { status: 201 });
}
