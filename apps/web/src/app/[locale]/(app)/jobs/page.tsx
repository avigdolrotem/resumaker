import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Plus, Search } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireActiveUser } from '@/lib/auth-guards';
import { listJobs } from '@/lib/jobs-query';
import { JobsList } from '@/components/jobs-list';
import { JobsSearch } from '@/components/jobs-search';

/**
 * /jobs — beta inbox. Lists imported + scraped jobs newest first, with
 * the user's per-job state (favorite + fit score) joined.
 *
 * Soft gate: users without access (no admin/beta-flag/paid-tier — see
 * beta-gate.ts) see a blurred preview + an upsell card instead of being
 * silently redirected. Creates demand for the feature without leaking
 * real job data. The API routes still hard-gate with
 * `requireJobHuntBetaApi`, so no data ever reaches a gated client — the
 * preview is sample data only.
 */
export default async function JobsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; q?: string; remote?: string }>;
}) {
  const { locale } = await params;
  const { page: pageParam, q: qParam, remote: remoteParam } = await searchParams;
  const guard = await requireActiveUser(await nextHeaders());
  if (guard instanceof Response) {
    redirect('/sign-in');
  }
  const t = await getTranslations({ locale, namespace: 'jobs' });
  const isHebrew = locale === 'he';

  // Server-rendered for whatever page the URL asks for (defaults to 1)
  // — JobsList (client) takes over from here for in-place page
  // navigation, same listJobs() query so it can't drift from this.
  const requestedPage = Number(pageParam ?? '1');
  const query = qParam?.trim() ?? '';
  const { jobs, page, totalPages, totalCount } = await listJobs({
    userId: guard.user.id,
    israeliOnly: true,
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    ...(query ? { q: query } : {}),
    ...(remoteParam === 'true' ? { remote: true } : {}),
  });
  const isFiltered = Boolean(query) || remoteParam === 'true';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{t('title')}</h1>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
              {t('betaBadge')}
            </span>
          </div>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/jobs/saved-searches">
              <Search className="me-2 h-4 w-4" />
              {t('savedSearches.navLabel')}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/jobs/paste">
              <Plus className="me-2 h-4 w-4" />
              {t('addJob')}
            </Link>
          </Button>
        </div>
      </div>

      <JobsSearch isHebrew={isHebrew} />

      {jobs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-16 text-center">
            {/* "No jobs yet — paste one to get started" is right for an
                empty board, but actively misleading after a search that
                matched nothing against ~17,000 listings. */}
            {isFiltered ? t('noResults') : t('empty')}
          </CardContent>
        </Card>
      ) : (
        <JobsList
          initialJobs={jobs}
          initialPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          isHebrew={isHebrew}
        />
      )}
    </div>
  );
}
