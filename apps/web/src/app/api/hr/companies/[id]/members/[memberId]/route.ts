/**
 * PATCH  /api/hr/companies/[id]/members/[memberId] — change role (owner only)
 * DELETE /api/hr/companies/[id]/members/[memberId] — kick member (owner only, cannot kick self)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';
import { requireHrOwner } from '@/lib/hr-guards';
import { auditEvent } from '@/lib/audit';

async function requireHr(h: Headers) {
  const guard = await requireActiveUser(h);
  if (guard instanceof NextResponse) return guard;
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return guard;
}

const PatchBody = z.object({
  role: z.enum(['recruiter', 'viewer']),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
): Promise<Response> {
  const guard = await requireHr(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id, memberId } = await params;
  const check = await requireHrOwner(id, guard.user.id, guard.user.role);
  if (check instanceof NextResponse) return check;

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const member = await db.query.companyMembers.findFirst({
    where: and(eq(schema.companyMembers.id, memberId), eq(schema.companyMembers.companyId, id)),
  });
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (member.role === 'owner') {
    return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });
  }

  await db
    .update(schema.companyMembers)
    .set({ role: body.role })
    .where(eq(schema.companyMembers.id, memberId));

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'hr_member_role_changed', companyId: id, memberId, role: body.role },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
): Promise<Response> {
  const guard = await requireHr(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id, memberId } = await params;
  const check = await requireHrOwner(id, guard.user.id, guard.user.role);
  if (check instanceof NextResponse) return check;

  const member = await db.query.companyMembers.findFirst({
    where: and(eq(schema.companyMembers.id, memberId), eq(schema.companyMembers.companyId, id)),
  });
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (member.userId === guard.user.id) {
    return NextResponse.json({ error: 'Owner cannot kick themselves' }, { status: 400 });
  }

  await db.delete(schema.companyMembers).where(eq(schema.companyMembers.id, memberId));

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'hr_member_removed', companyId: id, memberId },
  });

  return NextResponse.json({ success: true });
}
