/**
 * PATCH /api/account/profile — update name / locale preference
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';

const BodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  locale: z.enum(['he', 'en']).optional(),
});

export async function PATCH(req: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  if (!body.name && !body.locale) {
    return NextResponse.json({ error: 'No fields provided' }, { status: 400 });
  }

  await db
    .update(schema.users)
    .set({
      ...(body.name ? { name: body.name } : {}),
      ...(body.locale ? { locale: body.locale } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, session.user.id));

  auditEvent({
    userId: session.user.id,
    event: 'profile_updated',
    metadata: { fields: Object.keys(body) },
  });

  return NextResponse.json({ success: true });
}
