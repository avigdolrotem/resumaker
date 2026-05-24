/**
 * POST /api/hr/companies/[id]/accept-invite
 * Body: { token: string }
 *
 * Validates the invite token, creates a company_members row,
 * and deletes the invite. Caller must be authenticated.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';
import { auditEvent } from '@/lib/audit';

const Body = z.object({
  token: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const invite = await db.query.companyInvites.findFirst({
    where: and(
      eq(schema.companyInvites.token, body.token),
      eq(schema.companyInvites.companyId, id),
    ),
  });

  if (!invite) return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invite expired' }, { status: 410 });
  }

  // Check if already a member
  const existing = await db.query.companyMembers.findFirst({
    where: and(
      eq(schema.companyMembers.companyId, id),
      eq(schema.companyMembers.userId, guard.user.id),
    ),
  });
  if (existing) {
    // Already member — just clean up invite and return ok
    await db.delete(schema.companyInvites).where(eq(schema.companyInvites.id, invite.id));
    return NextResponse.json({ success: true, alreadyMember: true });
  }

  await db.insert(schema.companyMembers).values({
    companyId: id,
    userId: guard.user.id,
    role: invite.role ?? 'recruiter',
    invitedAt: invite.createdAt,
    acceptedAt: new Date(),
  });

  await db.delete(schema.companyInvites).where(eq(schema.companyInvites.id, invite.id));

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'hr_invite_accepted', companyId: id, role: invite.role },
  });

  return NextResponse.json({ success: true });
}
