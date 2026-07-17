import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { desc, eq, and } from 'drizzle-orm';
import { Plus, ExternalLink, Star } from 'lucide-react';
import { db, schema } from '@/db';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireActiveUser } from '@/lib/auth-guards';
import { hasJobHuntBeta } from '@/lib/beta-gate';
import { JobHuntPreview } from '@/components/job-hunt-preview';

/**
 * /jobs — beta inbox. Lists imported + scraped jobs newest first, with
 * the user's per-job state (favorite + fit score) joined.
 *
 * Soft beta gate: non-flagged users see a blurred preview + an upsell
 * card instead of being silently redirected. Creates demand for the
 * feature without leaking real job data. The API routes still hard-gate
 * with `requireJobHuntBetaApi`, so no data ever reaches a non-flagged
 * client — the preview is sample data only.
 */
export default async function JobsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const guard = await requireActiveUser(await nextHeaders());
  if (guard instanceof Response) {
    redirect('/sign-in');
  }
  if (!hasJobHuntBeta(guard.user)) {
    return <JobHuntPreview />;
  }
  const t = await getTranslations({ locale, namespace: 'jobs' });
  const isHebrew = locale === 'he';

  // Initial server-rendered page (20 newest). Client-side filtering /
  // pagination via SWR is a v1.1 polish — for now keep it simple.
  const jobs = await db
    .select({
      id: schema.jobs.id,
      company: schema.jobs.company,
      title: schema.jobs.title,
      location: schema.jobs.location,
      remote: schema.jobs.remote,
      url: schema.jobs.url,
      source: schema.jobs.source,
      scrapedAt: schema.jobs.scrapedAt,
      isFavorite: schema.userJobs.isFavorite,
      fitScore: schema.userJobs.fitScore,
    })
    .from(schema.jobs)
    .leftJoin(
      schema.userJobs,
      and(eq(schema.userJobs.jobId, schema.jobs.id), eq(schema.userJobs.userId, guard.user.id)),
    )
    .orderBy(desc(schema.jobs.scrapedAt))
    .limit(20);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{t('title')}</h1>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              {t('betaBadge')}
            </span>
          </div>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/jobs/paste">
            <Plus className="me-2 h-4 w-4" />
            {t('addJob')}
          </Link>
        </Button>
      </div>

      {jobs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-16 text-center">
            {t('empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {jobs.map((j) => (
            <Card key={j.id} className="hover:border-violet-300">
              <CardContent className="space-y-2 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 font-semibold">
                      <Link href={`/jobs/${j.id}`} className="hover:text-violet-700">
                        {j.title}
                      </Link>
                    </h3>
                    <p className="text-muted-foreground line-clamp-1 text-sm">
                      {j.company}
                      {j.location ? ` · ${j.location}` : ''}
                      {j.remote ? ` · ${isHebrew ? 'מרחוק' : 'Remote'}` : ''}
                    </p>
                  </div>
                  {j.isFavorite && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {j.source} ·{' '}
                    {new Date(j.scrapedAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US')}
                  </span>
                  <div className="flex items-center gap-3">
                    {j.fitScore !== null && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                        {j.fitScore}/10
                      </span>
                    )}
                    <a
                      href={j.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      aria-label={t('viewOriginal')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
