/**
 * POST /api/profile/complete-onboarding
 *
 * Marks the first-run career-profile wizard as done. Separate from the
 * content PATCH because "finished onboarding" and "content is valid"
 * are different questions — a user can legitimately finish the wizard
 * having skipped every optional section (projects/certs/awards/
 * languages), so this doesn't validate content shape at all, just
 * flips the timestamp that gates resume generation
 * (see /api/resumes/generate's NO_PROFILE check).
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

export async function POST(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, session.user.id),
    columns: { userId: true },
  });

  if (existing) {
    await db
      .update(schema.profiles)
      .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.profiles.userId, session.user.id));
  } else {
    await db.insert(schema.profiles).values({
      userId: session.user.id,
      content: { contact: { name: '' }, summary: '', experience: [], education: [], skills: [] },
      onboardingCompletedAt: new Date(),
    });
  }

  return NextResponse.json({ success: true });
}
