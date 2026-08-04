import { getTranslations } from 'next-intl/server';
import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ExternalLink, MapPin, Briefcase } from 'lucide-react';
import { db, schema } from '@/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireJobHuntBetaPage } from '@/lib/beta-gate';
import { JobActions } from '@/components/job-actions';
import { isSyntheticHrUrl } from '@/lib/hr-job-url';
import { GenerateResumeCta } from '@/components/generate-resume-cta';

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = (await params) as { locale: 'he' | 'en'; id: string };
  const guard = await requireJobHuntBetaPage();
  const t = await getTranslations({ locale, namespace: 'jobs' });

  const [job] = await db
    .select({
      id: schema.jobs.id,
      status: schema.jobs.status,
      submittedByUserId: schema.jobs.submittedByUserId,
      company: schema.jobs.company,
      title: schema.jobs.title,
      location: schema.jobs.location,
      description: schema.jobs.description,
      url: schema.jobs.url,
      source: schema.jobs.source,
      remote: schema.jobs.remote,
      seniority: schema.jobs.seniority,
      isFavorite: schema.userJobs.isFavorite,
      fitScore: schema.userJobs.fitScore,
      fitRationale: schema.userJobs.fitRationale,
      fitStrengths: schema.userJobs.fitStrengths,
      fitGaps: schema.userJobs.fitGaps,
    })
    .from(schema.jobs)
    .leftJoin(
      schema.userJobs,
      and(eq(schema.userJobs.jobId, schema.jobs.id), eq(schema.userJobs.userId, guard.user.id)),
    )
    .where(eq(schema.jobs.id, id))
    .limit(1);

  if (!job) notFound();

  // Pending (unmoderated) imports are visible only to their submitter
  // and to admins — same rule as GET /api/jobs/[id]. notFound() rather
  // than a redirect so the page doesn't confirm the row exists.
  if (
    job.status === 'pending' &&
    guard.user.role !== 'admin' &&
    job.submittedByUserId !== guard.user.id
  ) {
    notFound();
  }

  // Check if user already tracks this job — disables the Track button below.
  const existingApp = await db.query.applications.findFirst({
    where: and(eq(schema.applications.userId, guard.user.id), eq(schema.applications.jobId, id)),
    columns: { id: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{job.title}</h1>
        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3">
          <span className="font-medium">{job.company}</span>
          {job.location && (
            <span className="inline-flex items-center gap-1 text-sm">
              <MapPin className="h-3.5 w-3.5" /> {job.location}
            </span>
          )}
          {job.seniority && (
            <span className="inline-flex items-center gap-1 text-sm">
              <Briefcase className="h-3.5 w-3.5" /> {job.seniority}
            </span>
          )}
          {job.remote && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {locale === 'he' ? 'מרחוק' : 'Remote'}
            </span>
          )}
        </p>
      </div>

      <JobActions
        jobId={job.id}
        jobTitle={job.title}
        jobCompany={job.company}
        jobUrl={job.source === 'manual' ? null : job.url}
        isFavorite={Boolean(job.isFavorite)}
        fitScore={job.fitScore}
        fitRationale={job.fitRationale}
        fitStrengths={job.fitStrengths ?? []}
        fitGaps={job.fitGaps ?? []}
        alreadyTracked={Boolean(existingApp)}
        applicationId={existingApp?.id ?? null}
        locale={locale}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>{locale === 'he' ? 'תיאור המשרה' : 'Job description'}</span>
            {/* Manually-pasted jobs have no real source URL — job.url
                is a 'manual-paste' sentinel (see api/jobs/import/route.ts),
                not a link, so this would otherwise navigate to a
                nonsensical relative path built from that string. */}
            {/* Same problem for employer-posted jobs. `jobs.url` is NOT
                NULL, so a job posted through the HR form with no apply
                URL gets a synthetic `…/jobs/hr-<userId>` placeholder to
                satisfy the column. That is not a posting anywhere — this
                page IS the original — and offering "View original
                posting" sent job-seekers to a dead address on a domain
                that isn't even this app. */}
            {job.source !== 'manual' && !isSyntheticHrUrl(job.source, job.url) && (
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
              >
                {t('viewOriginal')} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* `break-words` because job descriptions are pasted from
              anywhere: an unbroken 10,000-character run has no space for
              normal wrapping to act on and ran straight off the side of
              the card, taking the page's horizontal scroll with it. */}
          <div className="text-foreground whitespace-pre-wrap break-words text-sm leading-relaxed">
            {job.description}
          </div>
          <GenerateResumeCta
            jobDescription={job.description}
            jobUrl={job.source === 'manual' ? null : job.url}
            isHebrew={locale === 'he'}
          />
        </CardContent>
      </Card>
    </div>
  );
}
