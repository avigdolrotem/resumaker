/**
 * POST /api/admin/users/[id]/role — change a user's role (admin only)
 *
 * Audit-logged. Returns 403 if caller is not admin.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth-guards';

const BodySchema = z.object({
  // `hr` is wired in L6: HR users post their own jobs and see only their
  // own applicants. Accepted here so the role enum stays stable across
  // migrations even before the HR surface ships.
  role: z.enum(['user', 'admin', 'support', 'suspended', 'hr']),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

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
  if (id === guard.user.id && body.role !== 'admin') {
    return NextResponse.json(
      { error: 'Cannot remove your own admin role. Ask another admin.' },
      { status: 400 },
    );
  }

  const target = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
    columns: { role: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await db
    .update(schema.users)
    .set({ role: body.role, updatedAt: new Date() })
    .where(eq(schema.users.id, id));

  // If suspending, also expire all sessions so they get kicked out.
  // The auth.ts session.create.before hook then prevents them from
  // signing back in until their role is restored.
  if (body.role === 'suspended') {
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
  }

  // Audit log stores only userId, never email — so when the target user
  // deletes their account, their email doesn't linger in our retention
  // (GDPR Art. 17). Operator can still resolve userId → user via the
  // admin panel if the user still exists.
  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: {
      kind: 'role_change',
      targetUserId: id,
      previousRole: target.role,
      newRole: body.role,
    },
  });

  return NextResponse.json({ success: true, role: body.role });
}
