/**
 * HR-specific authorization helpers.
 *
 * requireHrMember — verifies caller has any role in the given company
 * requireHrOwner  — verifies caller is the company owner
 *
 * Both return NextResponse on failure so callers can short-circuit:
 *
 *   const check = await requireHrMember(companyId, userId, role);
 *   if (check instanceof NextResponse) return check;
 */

import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';

export type CompanyMemberRole = 'owner' | 'recruiter' | 'viewer';

interface HrMemberGuard {
  member: typeof schema.companyMembers.$inferSelect;
}

/** Returns the member row or a 404 NextResponse. Admin bypasses membership check. */
export async function requireHrMember(
  companyId: string,
  userId: string,
  userRole: string,
): Promise<HrMemberGuard | NextResponse> {
  if (userRole === 'admin') {
    // Admins get synthetic owner-level access
    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, companyId),
    });
    if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const syntheticMember = {
      id: 'admin',
      companyId,
      userId,
      role: 'owner',
      invitedBy: null,
      invitedAt: null,
      acceptedAt: null,
      createdAt: new Date(),
    } satisfies typeof schema.companyMembers.$inferSelect;
    return { member: syntheticMember };
  }

  const member = await db.query.companyMembers.findFirst({
    where: and(
      eq(schema.companyMembers.companyId, companyId),
      eq(schema.companyMembers.userId, userId),
    ),
  });

  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return { member };
}

/** Returns member row if owner; 404 NextResponse otherwise. */
export async function requireHrOwner(
  companyId: string,
  userId: string,
  userRole: string,
): Promise<HrMemberGuard | NextResponse> {
  const result = await requireHrMember(companyId, userId, userRole);
  if (result instanceof NextResponse) return result;
  if (result.member.role !== 'owner') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return result;
}
