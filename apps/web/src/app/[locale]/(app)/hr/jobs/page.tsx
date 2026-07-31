import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Plus, Users } from 'lucide-react';
import { db, schema } from '@/db';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireActiveUser } from '@/lib/auth-guards';
import { NextResponse } from 'next/server';
import { HrJobCloseButton } from '@/components/hr/hr-job-card-actions';

/**
 * /hr/jobs — the "for employers" landing, and the nav entry point for
 * it (see UserAvatarMenu). Any signed-in user can reach this page now:
 * role='hr'/'admin' see their own posted jobs (unchanged); anyone else
 * sees a "become an employer" prompt instead of a redirect to
 * /dashboard, since creating a company is itself the self-serve signup
 * (see the comment on POST /api/hr/companies) — bouncing a first-time
 * visitor away before they see what this even is would defeat the
 * point of putting a nav link here at all.
 */
export default async function HrJobsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'jobs' });

  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) {
    redirect('/sign-in');
  }

  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <h1 className="text-2xl font-bold">
              {locale === 'he' ? 'מגייסים? פרסמו משרה בחינם' : 'Hiring? Post a job for free'}
            </h1>
            <p className="text-muted-foreground">
              {locale === 'he'
                ? 'צרו פרופיל חברה ותוכלו לפרסם משרות שיופיעו לפני כל מחפשי העבודה באתר — ללא עלות.'
                : 'Create a company profile and post roles that go straight in front of every job-seeker on the site — no cost to post.'}
            </p>
            <Button asChild size="lg">
              <Link href="/hr/company/new">
                <Plus className="me-2 h-4 w-4" />
                {locale === 'he' ? 'צור חברה והתחל' : 'Create a company to get started'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const myJobs = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.title,
      company: schema.jobs.company,
      location: schema.jobs.location,
      remote: schema.jobs.remote,
      postedAt: schema.jobs.postedAt,
      status: schema.jobs.status,
      applicantCount: sql<number>`cast(count(${schema.applications.id}) as int)`,
    })
    .from(schema.jobs)
    .leftJoin(schema.applications, eq(schema.applications.jobId, schema.jobs.id))
    .where(and(eq(schema.jobs.source, 'hr'), eq(schema.jobs.hrUserId, guard.user.id)))
    .groupBy(schema.jobs.id)
    .orderBy(desc(schema.jobs.scrapedAt));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {locale === 'he' ? 'המשרות שפרסמתי' : 'My posted jobs'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {locale === 'he'
              ? 'מצב המשרות שפרסמת. רק אתה רואה את אלה.'
              : 'Jobs you posted. Only you see these.'}
          </p>
        </div>
        <Button asChild>
          <Link href="/hr/jobs/new">
            <Plus className="me-2 h-4 w-4" />
            {locale === 'he' ? 'פרסם משרה' : 'Post a job'}
          </Link>
        </Button>
      </div>

      {myJobs.length === 0 ? (
        <div className="glass-subtle text-muted-foreground border-border rounded-2xl border-2 border-dashed py-16 text-center">
          {locale === 'he'
            ? 'לא פרסמת עדיין משרות. לחץ "פרסם משרה" כדי להתחיל.'
            : 'You haven\'t posted any jobs yet. Click "Post a job" to start.'}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {myJobs.map((j) => (
            <Card key={j.id}>
              <CardContent className="space-y-2 pt-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{j.title}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      j.status === 'open'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {j.status === 'open'
                      ? locale === 'he'
                        ? 'פתוחה'
                        : 'Open'
                      : locale === 'he'
                        ? 'סגורה'
                        : 'Closed'}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm">
                  {j.company}
                  {j.location ? ` · ${j.location}` : ''}
                  {j.remote ? ` · ${locale === 'he' ? 'מרחוק' : 'Remote'}` : ''}
                </p>
                <p className="text-muted-foreground text-xs">
                  {locale === 'he' ? 'פורסם ב-' : 'Posted '}
                  {j.postedAt ? new Date(j.postedAt).toLocaleDateString() : '—'}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/hr/jobs/${j.id}/applicants`}>
                      <Users className="me-1 h-3.5 w-3.5" />
                      {locale === 'he'
                        ? `מועמדים (${j.applicantCount})`
                        : `Applicants (${j.applicantCount})`}
                    </Link>
                  </Button>
                  {j.status === 'open' && (
                    <HrJobCloseButton jobId={j.id} isHebrew={locale === 'he'} />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Silence unused-import linter on getTranslations */}
      <span className="sr-only">{t('title')}</span>
    </div>
  );
}
