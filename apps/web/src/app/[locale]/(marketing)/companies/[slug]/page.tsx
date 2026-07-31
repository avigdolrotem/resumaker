import { notFound } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { db, schema } from '@/db';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { AnimatedMeshBg } from '@/components/ui-effects/animated-mesh-bg';
import { GlassPanel } from '@/components/ui-effects/glass-panel';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function CompanyPublicPage({ params }: Props) {
  const { locale, slug } = await params;

  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.slug, slug),
  });

  if (!company) notFound();

  const activeJobs = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.title,
      location: schema.jobs.location,
      remote: schema.jobs.remote,
      seniority: schema.jobs.seniority,
      postedAt: schema.jobs.postedAt,
    })
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.companyId, company.id),
        eq(schema.jobs.source, 'hr'),
        // This page is public and its heading says "Open positions" —
        // without this, a role an employer explicitly closed kept
        // rendering here with a working Apply button, forever.
        eq(schema.jobs.status, 'open'),
      ),
    );

  const isHe = locale === 'he';

  return (
    <div className="relative overflow-hidden py-12">
      <AnimatedMeshBg intensity="subtle" />
      <div className="relative z-10 mx-auto max-w-3xl space-y-8 px-4">
        <GlassPanel intensity="subtle" animateIn className="flex items-center gap-4 p-6 sm:p-8">
          {company.logoUrl && (
            <div className="glass-subtle flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={company.logoUrl}
                alt={company.name}
                className="h-full w-full object-contain"
              />
            </div>
          )}
          <div>
            <h1 className="text-4xl font-bold">{company.name}</h1>
            {company.websiteUrl && (
              <a
                href={company.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 dark:text-brand-300 text-sm hover:underline"
              >
                {company.websiteUrl}
              </a>
            )}
          </div>
        </GlassPanel>

        {company.description && (
          <p className="text-muted-foreground leading-relaxed">{company.description}</p>
        )}

        <section>
          <h2 className="mb-4 text-2xl font-semibold">
            {isHe ? 'משרות פתוחות' : 'Open positions'}
          </h2>

          {activeJobs.length === 0 ? (
            <p className="text-muted-foreground">
              {isHe ? 'אין משרות פתוחות כרגע.' : 'No open positions at this time.'}
            </p>
          ) : (
            <div className="space-y-3">
              {activeJobs.map((job) => (
                <Card key={job.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="font-medium">{job.title}</h3>
                        <p className="text-muted-foreground text-sm">
                          {job.location ?? (isHe ? 'מיקום לא צוין' : 'Location not specified')}
                          {job.remote && ` · ${isHe ? 'מרחוק' : 'Remote'}`}
                          {job.seniority && ` · ${job.seniority}`}
                        </p>
                      </div>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="bg-brand-600 hover:bg-brand-700 ease-snappy shrink-0 rounded-full px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.96]"
                      >
                        {isHe ? 'הגש מועמדות' : 'Apply'}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
