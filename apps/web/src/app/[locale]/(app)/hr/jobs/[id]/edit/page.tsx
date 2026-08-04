import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db, schema } from '@/db';
import { Link } from '@/i18n/navigation';
import { requireActiveUser } from '@/lib/auth-guards';
import { HrEditJobForm } from '@/components/hr/hr-edit-job-form';

/**
 * /hr/jobs/[id]/edit — correct an existing posting.
 *
 * Ownership is re-checked here rather than trusted from the fact that a
 * link was rendered: the same rule as the applicants page and as PATCH
 * itself, so all three agree and none of them is the only thing standing
 * between a recruiter and someone else's listing. An id belonging to
 * another company redirects rather than 404s, matching the sibling page.
 */
export default async function EditJobPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) redirect('/sign-in');
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') redirect('/dashboard');

  const job = await db.query.jobs.findFirst({
    where: and(eq(schema.jobs.id, id), eq(schema.jobs.source, 'hr')),
  });

  if (!job || (guard.user.role !== 'admin' && job.hrUserId !== guard.user.id)) {
    redirect('/hr/jobs');
  }

  const isHebrew = locale === 'he';
  const BackIcon = isHebrew ? ChevronRight : ChevronLeft;

  return (
    <div className="space-y-6">
      <Link
        href="/hr/jobs"
        className="text-muted-foreground hover:text-foreground ease-snappy inline-flex items-center gap-1.5 text-sm transition-colors duration-200"
      >
        <BackIcon className="h-4 w-4" />
        {isHebrew ? 'חזרה למשרות שלי' : 'Back to my jobs'}
      </Link>

      <HrEditJobForm
        job={{
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          remote: job.remote,
          seniority: job.seniority,
          status: job.status,
        }}
      />
    </div>
  );
}
