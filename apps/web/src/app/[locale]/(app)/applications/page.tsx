import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { Card, CardContent } from '@/components/ui/card';
import { requireActiveUser } from '@/lib/auth-guards';
import { hasJobHuntBeta } from '@/lib/beta-gate';
import { ApplicationsList } from '@/components/applications-list';
import { ApplicationsPreview } from '@/components/applications-preview';
import { Briefcase } from 'lucide-react';

/**
 * /applications — tracker view. Lists every application the current user
 * has tracked, with inline status updates.
 *
 * Soft beta gate: non-flagged users see a blurred preview + an upsell
 * card instead of being silently redirected, mirroring /jobs. The API
 * routes still hard-gate with `requireJobHuntBetaApi`, so no data ever
 * reaches a non-flagged client.
 */
export default async function ApplicationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: 'he' | 'en' };
  const guard = await requireActiveUser(await nextHeaders());
  if (guard instanceof Response) {
    redirect('/sign-in');
  }
  if (!hasJobHuntBeta(guard.user)) {
    return <ApplicationsPreview />;
  }
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
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="bg-brand-50 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <Briefcase className="text-brand-600 h-8 w-8" />
            </div>
            <p className="text-muted-foreground text-sm">{t('empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <ApplicationsList rows={rows} locale={locale} />
      )}
    </div>
  );
}
