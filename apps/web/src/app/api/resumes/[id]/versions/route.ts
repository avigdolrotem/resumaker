/**
 * GET  /api/resumes/[id]/versions  — list past versions (newest first)
 * POST /api/resumes/[id]/versions  — restore a version (body: { versionNumber: number })
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { and, eq, isNull, desc, gte } from 'drizzle-orm';
import { requireActiveUser } from '@/lib/auth-guards';
import { db, schema } from '@/db';
import { ResumeSchema } from '@resumaker/shared';
import { auditEvent } from '@/lib/audit';
import { getUserTier } from '@/lib/billing/tier';
import { TIER_LIMITS } from '@/lib/billing/limits';

async function ownsResume(resumeId: string, userId: string): Promise<boolean> {
  const row = await db.query.resumes.findFirst({
    where: and(
      eq(schema.resumes.id, resumeId),
      eq(schema.resumes.userId, userId),
      isNull(schema.resumes.deletedAt),
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  if (!(await ownsResume(id, guard.user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Tier-based retention. Free = 7 days, Plus = 90, Pro = unlimited (-1).
  // We don't actually delete rows older than the window (so an upgrade
  // re-exposes them); we just hide them from the response. The 30-day
  // purge cron does the eventual cleanup for users on lower tiers.
  const tier = await getUserTier(guard.user.id);
  const retentionDays = TIER_LIMITS[tier].versionHistoryDays;
  const cutoff =
    retentionDays === -1 ? null : new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const whereClause =
    cutoff !== null
      ? and(eq(schema.resumeVersions.resumeId, id), gte(schema.resumeVersions.createdAt, cutoff))
      : eq(schema.resumeVersions.resumeId, id);

  const versions = await db
    .select({
      id: schema.resumeVersions.id,
      versionNumber: schema.resumeVersions.versionNumber,
      title: schema.resumeVersions.title,
      label: schema.resumeVersions.label,
      createdAt: schema.resumeVersions.createdAt,
    })
    .from(schema.resumeVersions)
    .where(whereClause)
    .orderBy(desc(schema.resumeVersions.versionNumber));

  return NextResponse.json({
    versions,
    retention: { tier, days: retentionDays },
  });
}

const RestoreBody = z.object({
  versionNumber: z.number().int().positive(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  if (!(await ownsResume(id, guard.user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: z.infer<typeof RestoreBody>;
  try {
    body = RestoreBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const version = await db.query.resumeVersions.findFirst({
    where: and(
      eq(schema.resumeVersions.resumeId, id),
      eq(schema.resumeVersions.versionNumber, body.versionNumber),
    ),
  });
  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  const parsed = ResumeSchema.safeParse(version.content);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Version content invalid' }, { status: 500 });
  }

  // Snapshot the current state before restoring. Re-assert ownership +
  // not-deleted in the WHERE so a concurrent ownership change or soft-
  // delete between the ownsResume check above and this read is caught.
  const currentResume = await db.query.resumes.findFirst({
    where: and(
      eq(schema.resumes.id, id),
      eq(schema.resumes.userId, guard.user.id),
      isNull(schema.resumes.deletedAt),
    ),
  });
  if (currentResume) {
    const [latest] = await db
      .select({ version: schema.resumeVersions.versionNumber })
      .from(schema.resumeVersions)
      .where(eq(schema.resumeVersions.resumeId, id))
      .orderBy(desc(schema.resumeVersions.versionNumber))
      .limit(1);
    await db.insert(schema.resumeVersions).values({
      resumeId: id,
      versionNumber: (latest?.version ?? 0) + 1,
      content: currentResume.content,
      title: currentResume.title,
      label: 'pre-restore-snapshot',
    });
  }

  // Restore — TOCTOU defense: the UPDATE re-asserts userId so a
  // concurrent ownership change between ownsResume() and this write
  // cannot smuggle this row into another user's account.
  await db
    .update(schema.resumes)
    .set({
      content: parsed.data,
      title: version.title,
      locale: parsed.data.metadata.language,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.resumes.id, id),
        eq(schema.resumes.userId, guard.user.id),
        isNull(schema.resumes.deletedAt),
      ),
    );

  auditEvent({
    userId: guard.user.id,
    event: 'resume_updated',
    metadata: { resumeId: id, restoredVersion: body.versionNumber },
  });

  return NextResponse.json({ success: true, restoredVersion: body.versionNumber });
}
