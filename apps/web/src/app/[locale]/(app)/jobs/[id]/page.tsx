import { getTranslations } from 'next-intl/server';
import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ExternalLink, MapPin, Briefcase } from 'lucide-react';
import { db, schema } from '@/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireJobHuntBetaPage } from '@/lib/beta-gate';
import { JobActions } from '@/components/job-actions';

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
      company: schema.jobs.company,
      title: schema.jobs.title,
      location: schema.jobs.location,
      description: schema.jobs.description,
      url: schema.jobs.url,
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
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {locale === 'he' ? 'מרחוק' : 'Remote'}
            </span>
          )}
        </p>
      </div>

      <JobActions
        jobId={job.id}
        isFavorite={Boolean(job.isFavorite)}
        fitScore={job.fitScore}
        fitRationale={job.fitRationale}
        fitStrengths={job.fitStrengths ?? []}
        fitGaps={job.fitGaps ?? []}
        alreadyTracked={Boolean(existingApp)}
        locale={locale}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>{locale === 'he' ? 'תיאור המשרה' : 'Job description'}</span>
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
            >
              {t('viewOriginal')} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
            {job.description}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
