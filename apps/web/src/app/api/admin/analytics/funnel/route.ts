/**
 * GET /api/admin/analytics/funnel
 *
 * Returns { signups, firstResume, paid } for the last 30 days.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, gte, ne, count, isNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth-guards';

export async function GET(_req: NextRequest): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [signupsRow] = await db
    .select({ count: count() })
    .from(schema.users)
    .where(and(gte(schema.users.createdAt, since), isNull(schema.users.deletedAt)));

  // Users who created at least one resume in last 30 days
  const firstResumeRows = await db
    .selectDistinct({ userId: schema.resumes.userId })
    .from(schema.resumes)
    .where(gte(schema.resumes.createdAt, since));

  // Users who went paid in last 30 days
  const [paidRow] = await db
    .select({ count: count() })
    .from(schema.subscriptions)
    .where(and(ne(schema.subscriptions.tier, 'free'), gte(schema.subscriptions.createdAt, since)));

  return NextResponse.json({
    signups: signupsRow?.count ?? 0,
    firstResume: firstResumeRows.length,
    paid: paidRow?.count ?? 0,
  });
}
