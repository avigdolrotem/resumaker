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
import { requireActiveUser } from '@/lib/auth-guards';
import { db, schema } from '@/db';

export async function POST(): Promise<Response> {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return guard;

  const existing = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, guard.user.id),
    columns: { userId: true },
  });

  if (existing) {
    await db
      .update(schema.profiles)
      .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.profiles.userId, guard.user.id));
  } else {
    await db.insert(schema.profiles).values({
      userId: guard.user.id,
      content: { contact: { name: '' }, summary: '', experience: [], education: [], skills: [] },
      onboardingCompletedAt: new Date(),
    });
  }

  return NextResponse.json({ success: true });
}
