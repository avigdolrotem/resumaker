import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { ProfileContent } from '@resumaker/shared';
import { requireActiveUser } from '@/lib/auth-guards';
import { db, schema } from '@/db';
import { OnboardingWizard } from './onboarding-wizard';

/**
 * /career-profile/onboarding — first-run, step-by-step career-profile
 * setup: Contact (prefilled from the account) → Summary → Experience
 * → Education → Projects → Skills → Certifications → Awards →
 * Languages, one section per step, with an import option up front.
 *
 * Already-completed users who navigate here directly get bounced to
 * the regular always-visible editor instead — this route is one-time
 * setup, not a second way to edit an existing profile.
 */
export default async function CareerProfileOnboardingPage() {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) {
    redirect('/sign-in');
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, guard.user.id),
  });
  if (profile?.onboardingCompletedAt) {
    redirect('/career-profile');
  }

  return (
    <OnboardingWizard
      accountName={guard.user.name ?? ''}
      accountEmail={guard.user.email}
      initialContent={(profile?.content as ProfileContent | undefined) ?? null}
    />
  );
}
