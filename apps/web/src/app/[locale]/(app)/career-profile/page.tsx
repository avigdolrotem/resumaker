import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth-guards';
import { db, schema } from '@/db';
import { CareerProfileClient } from './career-profile-client';

/**
 * /career-profile — the canonical contact/summary/experience/education/
 * etc. profile every generated resume tailors to a job description.
 *
 * Deliberately named + routed apart from /profile (account identity:
 * name, UI language, account stats) — same person, two different
 * concerns, and conflating them was exactly the confusion this route
 * exists to avoid. Nav entries for each carry distinct labels/icons
 * (see components/app-header-menus.tsx, mobile-drawer.tsx).
 *
 * A user who hasn't finished the first-run wizard yet (or has no
 * profile row at all) gets sent to /career-profile/onboarding instead
 * of the always-visible editor here — checked server-side so there's
 * no client-fetch-then-redirect flash.
 */
export default async function CareerProfilePage() {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) {
    redirect('/sign-in');
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, guard.user.id),
    columns: { onboardingCompletedAt: true },
  });
  if (!profile || !profile.onboardingCompletedAt) {
    redirect('/career-profile/onboarding');
  }

  return <CareerProfileClient />;
}
