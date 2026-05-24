/**
 * GET    /api/hr/companies/[id] — single company with member list
 * PATCH  /api/hr/companies/[id] — update (owner only)
 * DELETE /api/hr/companies/[id] — delete (owner only, cascades)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';
import { requireHrMember, requireHrOwner } from '@/lib/hr-guards';
import { auditEvent } from '@/lib/audit';

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

  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.id, id),
    with: {
      companyMembers: { with: { user: { columns: { id: true, email: true, name: true } } } },
    },
  });

  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ company });
}

const PatchBody = z.object({
  name: z.string().min(1).max(200).optional(),
  logoUrl: z.string().url().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  websiteUrl: z.string().url().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireHr(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
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

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates['name'] = body.name;
  if (body.logoUrl !== undefined) updates['logoUrl'] = body.logoUrl;
  if (body.description !== undefined) updates['description'] = body.description;
  if (body.websiteUrl !== undefined) updates['websiteUrl'] = body.websiteUrl;

  await db.update(schema.companies).set(updates).where(eq(schema.companies.id, id));

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'hr_company_updated', companyId: id },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireHr(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const check = await requireHrOwner(id, guard.user.id, guard.user.role);
  if (check instanceof NextResponse) return check;

  await db.delete(schema.companies).where(eq(schema.companies.id, id));

  auditEvent({
    userId: guard.user.id,
    event: 'admin_action',
    metadata: { kind: 'hr_company_deleted', companyId: id },
  });

  return NextResponse.json({ success: true });
}
