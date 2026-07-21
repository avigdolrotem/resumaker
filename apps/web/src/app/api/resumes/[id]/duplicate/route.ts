/**
 * POST /api/resumes/[id]/duplicate — create a copy of an existing resume
 *
 * Useful for "use as starting point" workflow. New resume starts fresh
 * (no version history).
 *
 * Currently has no UI caller — "Duplicate" was removed from the resume
 * grid's actions menu when per-resume hand-editing went away (content
 * now comes from the shared career profile, not independent per-resume
 * copies). Left working rather than deleted in case a future "start a
 * new resume from this one" flow wants it back.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { auditEvent } from '@/lib/audit';
import { canCreateResume, getActiveResumeCount, getUserTier } from '@/lib/billing/tier';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const original = await db.query.resumes.findFirst({
    where: and(
      eq(schema.resumes.id, id),
      eq(schema.resumes.userId, session.user.id),
      isNull(schema.resumes.deletedAt),
    ),
  });

  if (!original) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Tier gate: duplicating still counts toward the resume cap
  const [tier, activeCount] = await Promise.all([
    getUserTier(session.user.id),
    getActiveResumeCount(session.user.id),
  ]);
  const gate = canCreateResume(tier, activeCount);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: 'Resume limit reached for your tier',
        code: 'TIER_LIMIT',
        reasonKey: gate.reasonKey,
        requiredTier: gate.requiredTier,
        current: gate.current,
        limit: gate.limit,
      },
      { status: 402 },
    );
  }

  // Naive "Copy of ..." prefix; cap title length
  const copyPrefix = original.locale === 'he' ? 'עותק של ' : 'Copy of ';
  const newTitle = (copyPrefix + original.title).slice(0, 255);

  const [row] = await db
    .insert(schema.resumes)
    .values({
      userId: session.user.id,
      title: newTitle,
      jobTitle: original.jobTitle,
      companyName: original.companyName,
      locale: original.locale,
      templateId: original.templateId,
      content: original.content,
    })
    .returning({ id: schema.resumes.id });

  auditEvent({
    userId: session.user.id,
    event: 'resume_created',
    metadata: { kind: 'duplicate', sourceId: id, newId: row?.id },
  });

  return NextResponse.json({ id: row?.id });
}
