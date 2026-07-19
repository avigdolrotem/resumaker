import { inArray, desc } from 'drizzle-orm';
import { db, schema } from '@/db';

/**
 * Latest ATS `overall` score per resume id, for a set of resumes already
 * known to belong to the caller (this does no ownership check itself —
 * callers query `resumeIds` from an already-scoped `resumes` query).
 *
 * A resume can have several score rows over time (one per score check,
 * not just one per save), so this isn't a plain join — rows are pulled
 * newest-first and only the first one seen per resumeId is kept.
 */
export async function getLatestScoresByResumeId(resumeIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (resumeIds.length === 0) return result;

  const rows = await db.query.atsScores.findMany({
    where: inArray(schema.atsScores.resumeId, resumeIds),
    orderBy: [desc(schema.atsScores.createdAt)],
    columns: { resumeId: true, overall: true },
  });

  for (const row of rows) {
    if (!result.has(row.resumeId)) result.set(row.resumeId, row.overall);
  }
  return result;
}
