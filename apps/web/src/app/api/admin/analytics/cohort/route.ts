/**
 * GET /api/admin/analytics/cohort
 *
 * Returns 8-week cohort retention table.
 * Each entry: { cohortWeek, week0..7: percentActive }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, gte, lte, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth-guards';

function startOfWeek(d: Date): Date {
  const day = new Date(d);
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() - day.getUTCDay());
  return day;
}

function addWeeks(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 7 * 24 * 60 * 60 * 1000);
}

export async function GET(_req: NextRequest): Promise<Response> {
  const guard = await requireAdmin(await headers());
  if (guard instanceof NextResponse) return guard;

  const now = new Date();
  const cohortTable: Array<{ cohortWeek: string; weeks: number[] }> = [];

  for (let i = 7; i >= 0; i--) {
    const cohortStart = startOfWeek(addWeeks(now, -i));
    const cohortEnd = addWeeks(cohortStart, 1);

    // Users who signed up this week
    const cohortUsers = await db.query.users.findMany({
      where: and(gte(schema.users.createdAt, cohortStart), lte(schema.users.createdAt, cohortEnd)),
      columns: { id: true },
    });

    const cohortSize = cohortUsers.length;
    const weeks: number[] = [];

    for (let w = 0; w <= 7 - i; w++) {
      const weekStart = addWeeks(cohortStart, w);
      const weekEnd = addWeeks(weekStart, 1);

      if (weekEnd > now) {
        weeks.push(-1); // Future week, no data
        continue;
      }

      if (cohortSize === 0) {
        weeks.push(0);
        continue;
      }

      // Count distinct users from cohort who were active (sign_in) this week
      const activeRows = await db
        .select({ userId: schema.auditLog.userId })
        .from(schema.auditLog)
        .where(
          and(
            eq(schema.auditLog.event, 'sign_in'),
            gte(schema.auditLog.createdAt, weekStart),
            lte(schema.auditLog.createdAt, weekEnd),
          ),
        );

      const cohortIds = new Set(cohortUsers.map((u) => u.id));
      const activeCount = activeRows.filter((r) => r.userId && cohortIds.has(r.userId)).length;
      weeks.push(Math.round((activeCount / cohortSize) * 100));
    }

    cohortTable.push({
      cohortWeek: cohortStart.toISOString().slice(0, 10),
      weeks,
    });
  }

  return NextResponse.json({ cohortTable });
}
