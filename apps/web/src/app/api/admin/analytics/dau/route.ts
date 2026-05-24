/**
 * GET /api/admin/analytics/dau
 *
 * Returns array of { date, count } for the last 30 days.
 * Count = distinct userId in audit_log where event='sign_in', grouped by date.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, gte, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth-guards';

export async function GET(_req: NextRequest): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      date: sql<string>`DATE("created_at")`.as('date'),
      count: sql<number>`COUNT(DISTINCT "user_id")`.as('count'),
    })
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.event, 'sign_in'), gte(schema.auditLog.createdAt, since)))
    .groupBy(sql`DATE("created_at")`)
    .orderBy(sql`DATE("created_at")`);

  return NextResponse.json({ rows });
}
