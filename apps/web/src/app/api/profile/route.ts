/**
 * GET   /api/profile — the caller's canonical career profile (contact,
 *                       summary, experience, education, etc.). Creates
 *                       an empty default row on first read rather than
 *                       404ing, so the career-profile page and the
 *                       onboarding wizard can always render a form.
 * PATCH /api/profile — replace the profile content wholesale. The
 *                       client (career-profile page / onboarding
 *                       wizard) always holds the complete current
 *                       ProfileContent and sends the complete next
 *                       state on every save — same convention the old
 *                       per-resume advanced editor used, not a partial
 *                       merge patch.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { ProfileContentSchema } from '@resumaker/shared';
import { auditEvent } from '@/lib/audit';

const EMPTY_PROFILE_CONTENT = {
  contact: { name: '' },
  summary: '',
  experience: [],
  education: [],
  skills: [],
};

export async function GET(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let row = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, session.user.id),
  });

  if (!row) {
    // First-ever read for this user — create the empty row now so
    // every subsequent read/write is a normal update, not a
    // does-it-exist branch scattered across every caller.
    [row] = await db
      .insert(schema.profiles)
      .values({ userId: session.user.id, content: EMPTY_PROFILE_CONTENT })
      .returning();
  }

  return NextResponse.json({
    content: row?.content ?? EMPTY_PROFILE_CONTENT,
    onboardingCompletedAt: row?.onboardingCompletedAt ?? null,
  });
}

/**
 * Hard cap on serialized profile size — same reasoning as the resume
 * content cap (protects against a malicious/runaway client packing an
 * oversized JSONB payload into one row).
 */
const MAX_PROFILE_BYTES = 64 * 1024;

export async function PATCH(req: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let content: ReturnType<typeof ProfileContentSchema.parse>;
  try {
    const raw = await req.json();
    content = ProfileContentSchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid profile content', detail: (err as Error).message },
      { status: 400 },
    );
  }

  if (JSON.stringify(content).length > MAX_PROFILE_BYTES) {
    return NextResponse.json(
      { error: `Profile content exceeds ${MAX_PROFILE_BYTES / 1024} KB limit` },
      { status: 400 },
    );
  }

  const existing = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, session.user.id),
    columns: { userId: true },
  });

  if (existing) {
    await db
      .update(schema.profiles)
      .set({ content, updatedAt: new Date() })
      .where(eq(schema.profiles.userId, session.user.id));
  } else {
    await db.insert(schema.profiles).values({ userId: session.user.id, content });
  }

  auditEvent({
    userId: session.user.id,
    event: 'profile_updated',
    metadata: { kind: 'career_profile' },
  });

  return NextResponse.json({ success: true });
}
