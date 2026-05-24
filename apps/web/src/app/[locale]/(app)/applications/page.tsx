import { getTranslations } from 'next-intl/server';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { Card, CardContent } from '@/components/ui/card';
import { requireJobHuntBetaPage } from '@/lib/beta-gate';
import { ApplicationsList } from '@/components/applications-list';

/**
 * /applications — tracker view. Lists every application the current user
 * has tracked, with inline status updates. Beta-gated.
 */
export default async function ApplicationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: 'he' | 'en' };
  const guard = await requireJobHuntBetaPage();
  const t = await getTranslations({ locale, namespace: 'applications' });

  const rows = await db
    .select({
      id: schema.applications.id,
      jobId: schema.applications.jobId,
      jobTitle: schema.jobs.title,
      jobCompany: schema.jobs.company,
      jobUrl: schema.jobs.url,
      status: schema.applications.status,
      notes: schema.applications.notes,
      nextActionAt: schema.applications.nextActionAt,
      appliedAt: schema.applications.appliedAt,
      updatedAt: schema.applications.updatedAt,
    })
    .from(schema.applications)
    .innerJoin(schema.jobs, eq(schema.applications.jobId, schema.jobs.id))
    .where(eq(schema.applications.userId, guard.user.id))
    .orderBy(desc(schema.applications.updatedAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-neutral-600">{t('subtitle')}</p>
      </div>

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-neutral-500">{t('empty')}</CardContent>
        </Card>
      ) : (
        <ApplicationsList rows={rows} locale={locale} />
      )}
    </div>
  );
}
