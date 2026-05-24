/**
 * POST   /api/account/avatar — upload avatar (base64 data URL <=2MB)
 * DELETE /api/account/avatar — clear avatar
 *
 * Body: { dataUrl: "data:image/png;base64,..." }
 *
 * Stored inline as text in users.avatar. Skipping S3 to keep the
 * dependency surface minimal — 2MB cap means even 100K users would
 * only consume ~200GB which is fine in Postgres. If load grows we
 * swap the store; the client-side contract stays the same.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireActiveUser } from '@/lib/auth-guards';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME = /^data:image\/(png|jpeg|webp|gif);base64,/;

const BodySchema = z.object({
  dataUrl: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME.test(body.dataUrl)) {
    return NextResponse.json({ error: 'Only PNG, JPEG, WebP, GIF allowed' }, { status: 400 });
  }
  if (body.dataUrl.length > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Avatar exceeds 2MB. Pick a smaller image.' },
      { status: 413 },
    );
  }

  await db
    .update(schema.users)
    .set({ avatar: body.dataUrl, updatedAt: new Date() })
    .where(eq(schema.users.id, guard.user.id));

  auditEvent({
    userId: guard.user.id,
    event: 'profile_updated',
    metadata: { kind: 'avatar_uploaded', sizeBytes: body.dataUrl.length },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  await db
    .update(schema.users)
    .set({ avatar: null, updatedAt: new Date() })
    .where(eq(schema.users.id, guard.user.id));

  auditEvent({
    userId: guard.user.id,
    event: 'profile_updated',
    metadata: { kind: 'avatar_cleared' },
  });
  return NextResponse.json({ success: true });
}
