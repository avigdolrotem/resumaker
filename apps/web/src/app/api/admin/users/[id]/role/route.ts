/**
 * POST /api/admin/users/[id]/role — change a user's role (admin only)
 *
 * Audit-logged. Returns 403 if caller is not admin.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';

const BodySchema = z.object({
  role: z.enum(['user', 'admin', 'support', 'suspended']),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Caller must be admin
  const caller = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: { role: true },
  });
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  // Don't allow demoting self (avoid lock-out)
  if (id === session.user.id && body.role !== 'admin') {
    return NextResponse.json(
      { error: 'Cannot remove your own admin role. Ask another admin.' },
      { status: 400 },
    );
  }

  const target = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
    columns: { email: true, role: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await db
    .update(schema.users)
    .set({ role: body.role, updatedAt: new Date() })
    .where(eq(schema.users.id, id));

  // If suspending, also expire all sessions so they get kicked out
  if (body.role === 'suspended') {
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
  }

  auditEvent({
    userId: session.user.id,
    event: 'admin_action',
    metadata: {
      kind: 'role_change',
      targetUserId: id,
      targetEmail: target.email,
      previousRole: target.role,
      newRole: body.role,
    },
  });

  return NextResponse.json({ success: true, role: body.role });
}
