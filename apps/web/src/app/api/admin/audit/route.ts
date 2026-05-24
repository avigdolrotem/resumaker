/**
 * GET /api/admin/audit?from=&to=&event=&userId=&q=&page=&pageSize=
 *
 * Admin-only. Returns paginated audit log rows.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, gte, lte, eq, desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth-guards';

export async function GET(req: NextRequest): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const sp = req.nextUrl.searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  const event = sp.get('event');
  const userId = sp.get('userId');
  const page = Math.max(1, Number(sp.get('page') ?? '1'));
  const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize') ?? '50')));

  const conditions = [];
  if (from) conditions.push(gte(schema.auditLog.createdAt, new Date(from)));
  if (to) conditions.push(lte(schema.auditLog.createdAt, new Date(to)));
  if (event) conditions.push(eq(schema.auditLog.event, event));
  if (userId) conditions.push(eq(schema.auditLog.userId, userId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.query.auditLog.findMany({
    where,
    orderBy: [desc(schema.auditLog.createdAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return NextResponse.json({ rows, page, pageSize });
}
