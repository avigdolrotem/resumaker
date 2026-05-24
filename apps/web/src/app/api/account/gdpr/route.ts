/**
 * GDPR self-serve endpoints.
 *
 * Single route handles four action types via a `kind` body field so we
 * don't need four separate route files. Each action audits to a row
 * tagged `gdpr_request` so the operator can prove compliance later.
 *
 *   - rectify         (Art 16)  — correct factual mistake; updates name/etc
 *   - restrict        (Art 18)  — pause processing; marks user.deletedAt = null
 *                                 but sets a restrictionFlag in featureFlags
 *   - object          (Art 21)  — opt out of marketing; forces marketingOptIn=false
 *   - withdraw        (Art 7.3) — withdraw consent for non-essential processing;
 *                                 clears all notificationPrefs to false
 *
 * Deletion (Art 17) is handled by the existing DELETE /api/account route.
 * Access (Art 15) is handled by /api/account/export.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireActiveUser } from '@/lib/auth-guards';

const BodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rectify'), name: z.string().min(1).max(200) }),
  z.object({ kind: z.literal('restrict') }),
  z.object({ kind: z.literal('object') }),
  z.object({ kind: z.literal('withdraw') }),
]);

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

  switch (body.kind) {
    case 'rectify':
      await db
        .update(schema.users)
        .set({ name: body.name, updatedAt: new Date() })
        .where(eq(schema.users.id, guard.user.id));
      break;

    case 'restrict': {
      const currentFlags = guard.user.featureFlags ?? {};
      await db
        .update(schema.users)
        .set({
          featureFlags: { ...currentFlags, processingRestricted: true } as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, guard.user.id));
      break;
    }

    case 'object':
      await db
        .update(schema.users)
        .set({ marketingOptIn: false, updatedAt: new Date() })
        .where(eq(schema.users.id, guard.user.id));
      break;

    case 'withdraw':
      await db
        .update(schema.users)
        .set({
          marketingOptIn: false,
          notificationPrefs: {
            emailResumeGenerated: false,
            emailJobDigest: false,
            emailApplicationReminders: false,
            emailProductUpdates: false,
            pushAll: false,
          },
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, guard.user.id));
      break;
  }

  auditEvent({
    userId: guard.user.id,
    event: 'profile_updated',
    metadata: { kind: 'gdpr_request', action: body.kind, fulfilledAt: new Date().toISOString() },
  });

  return NextResponse.json({ success: true, action: body.kind });
}
