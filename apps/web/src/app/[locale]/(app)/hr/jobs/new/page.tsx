import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth-guards';
import { HrPostJobForm } from '@/components/hr/hr-post-job-form';

/**
 * /hr/jobs/new — HR users post a new job.
 *
 * Same role in (hr, admin) gate as /hr/jobs itself (which redirects a
 * regular user to /dashboard) — this page used to be a bare 'use
 * client' component with no server-side check of its own, so a
 * regular job-seeker who landed here directly saw a fully working
 * "post a job" form and only found out it wasn't for them after
 * filling it in and hitting submit (the API route was always
 * correctly gated; the page around it wasn't). The interactive form
 * itself now lives in HrPostJobForm.
 */
export default async function HrPostJobPage() {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) {
    redirect('/sign-in');
  }
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') {
    redirect('/dashboard');
  }

  return <HrPostJobForm />;
}
