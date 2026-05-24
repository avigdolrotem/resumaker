import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { db, schema } from '@/db';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireActiveUser } from '@/lib/auth-guards';
import { NextResponse } from 'next/server';

/**
 * /hr/jobs — HR-only landing.
 *
 * Only role='hr' (or admin) can see this. Regular users get redirected
 * to /dashboard. Lists this HR user's own posted jobs — they can never
 * see other HR users' jobs from the UI.
 */
export default async function HrJobsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'jobs' });

  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) {
    redirect('/sign-in');
  }
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') {
    redirect('/dashboard');
  }

  const myJobs = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.title,
      company: schema.jobs.company,
      location: schema.jobs.location,
      remote: schema.jobs.remote,
      postedAt: schema.jobs.postedAt,
    })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.source, 'hr'), eq(schema.jobs.hrUserId, guard.user.id)))
    .orderBy(desc(schema.jobs.scrapedAt));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {locale === 'he' ? 'המשרות שפרסמתי' : 'My posted jobs'}
          </h1>
          <p className="mt-1 text-neutral-600">
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
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-neutral-500">
            {locale === 'he'
              ? 'לא פרסמת עדיין משרות. לחץ "פרסם משרה" כדי להתחיל.'
              : 'You haven\'t posted any jobs yet. Click "Post a job" to start.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {myJobs.map((j) => (
            <Card key={j.id}>
              <CardContent className="space-y-1 pt-5">
                <h3 className="font-semibold">{j.title}</h3>
                <p className="text-sm text-neutral-600">
                  {j.company}
                  {j.location ? ` · ${j.location}` : ''}
                  {j.remote ? ` · ${locale === 'he' ? 'מרחוק' : 'Remote'}` : ''}
                </p>
                <p className="text-xs text-neutral-500">
                  {locale === 'he' ? 'פורסם ב-' : 'Posted '}
                  {j.postedAt ? new Date(j.postedAt).toLocaleDateString() : '—'}
                </p>
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
