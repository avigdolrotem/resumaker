/**
 * PATCH /api/account/preferences — update theme / timezone / date format /
 * marketing opt-in / notification preferences.
 *
 * Each field optional; only present keys are updated. notificationPrefs
 * is merged, not replaced — partial updates don't wipe other flags.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireActiveUser } from '@/lib/auth-guards';

const BodySchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  timezone: z.string().min(1).max(64).optional(),
  dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
  marketingOptIn: z.boolean().optional(),
  notificationPrefs: z
    .object({
      emailResumeGenerated: z.boolean().optional(),
      emailJobDigest: z.boolean().optional(),
      emailApplicationReminders: z.boolean().optional(),
      emailProductUpdates: z.boolean().optional(),
      pushAll: z.boolean().optional(),
    })
    .optional(),
});

export async function PATCH(req: NextRequest): Promise<Response> {
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

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.theme !== undefined) updates['theme'] = body.theme;
  if (body.timezone !== undefined) updates['timezone'] = body.timezone;
  if (body.dateFormat !== undefined) updates['dateFormat'] = body.dateFormat;
  if (body.marketingOptIn !== undefined) updates['marketingOptIn'] = body.marketingOptIn;
  if (body.notificationPrefs) {
    // Merge with existing
    updates['notificationPrefs'] = {
      ...(guard.user.notificationPrefs ?? {}),
      ...body.notificationPrefs,
    };
  }

  await db.update(schema.users).set(updates).where(eq(schema.users.id, guard.user.id));

  auditEvent({
    userId: guard.user.id,
    event: 'profile_updated',
    metadata: { kind: 'preferences', fields: Object.keys(body) },
  });

  return NextResponse.json({ success: true });
}
