/**
 * GET  /api/hr/companies/[id]/members — list members
 * POST /api/hr/companies/[id]/members — invite (owner creates invite + sends email)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';
import { requireHrMember, requireHrOwner } from '@/lib/hr-guards';
import { sendEmail } from '@/lib/email/client';
import { escapeHtml } from '@/lib/email/templates';
import { auditEvent } from '@/lib/audit';
import { env } from '@/lib/env';
import { logger } from '@/lib/observability';
import { createHash } from 'crypto';

async function requireHr(h: Headers) {
  const guard = await requireActiveUser(h);
  if (guard instanceof NextResponse) return guard;
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return guard;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireHr(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const check = await requireHrMember(id, guard.user.id, guard.user.role);
  if (check instanceof NextResponse) return check;

  const members = await db.query.companyMembers.findMany({
    where: eq(schema.companyMembers.companyId, id),
    with: { user: { columns: { id: true, email: true, name: true, image: true } } },
  });

  return NextResponse.json({ members });
}

const PostBody = z.object({
  email: z.string().email().max(320),
  role: z.enum(['recruiter', 'viewer']).default('recruiter'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireHr(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const check = await requireHrOwner(id, guard.user.id, guard.user.role);
  if (check instanceof NextResponse) return check;

  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.id, id),
  });
  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [invite] = await db
    .insert(schema.companyInvites)
    .values({
      companyId: id,
      email: body.email,
      token,
      role: body.role,
      expiresAt,
    })
    .returning({ id: schema.companyInvites.id });

  // Use validated env.APP_URL (single source of truth) instead of a raw
  // NEXT_PUBLIC_BASE_URL env that was never declared in env.ts and was
  // falling back to a hardcoded literal.
  const acceptUrl = `${env.APP_URL}/en/hr/company/${id}/accept-invite?token=${token}`;

  // company.name and body.role come from HR-user input. HR users are NOT
  // fully trusted (anyone with role=hr can create a company with name=
  // "<script>...</script>" and invite arbitrary external addresses).
  // Escape before interpolating into HTML.
  const safeCompanyName = escapeHtml(company.name);
  const safeRole = escapeHtml(body.role);
  const result = await sendEmail({
    to: body.email,
    subject: `You've been invited to join ${company.name} on Resumaker`,
    html: `
      <p>You've been invited to join <strong>${safeCompanyName}</strong> as a ${safeRole}.</p>
      <p><a href="${acceptUrl}">Accept invitation</a></p>
      <p>This link expires in 7 days.</p>
    `,
    text: `Accept your invitation: ${acceptUrl}`,
  });
  if (!result.ok) {
    // Surface so HR doesn't see "invite sent" when nothing was sent.
    // Roll back the invite row so they can retry without hitting a
    // unique constraint on (companyId, email) on a stale row.
    await db.delete(schema.companyInvites).where(eq(schema.companyInvites.token, token));
    logger.warn(
      { err: result.error, companyId: id, inviteEmail: body.email },
      'hr.invite.email_send_failed',
    );
    return NextResponse.json(
      { error: 'Failed to send invite email. Please try again.' },
      { status: 502 },
    );
  }

  // PRIVACY: never store raw invitee email in audit metadata. The L1
  // finding ("no PII in audit metadata") was being violated. Hash the
  // email with the same salt used for IPs so the audit row is still
  // correlatable if needed for abuse investigation.
  const salt = process.env.IP_HASH_SALT ?? process.env.BETTER_AUTH_SECRET ?? '';
  const emailHash = salt
    ? createHash('sha256').update(`${salt}|${body.email}`).digest('hex').slice(0, 16)
    : null;
  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: {
      kind: 'hr_member_invited',
      companyId: id,
      inviteId: invite?.id,
      emailHash,
    },
  });

  return NextResponse.json({ inviteId: invite?.id }, { status: 201 });
}
