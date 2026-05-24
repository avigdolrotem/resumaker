import { notFound } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { db, schema } from '@/db';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';

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
    .where(and(eq(schema.jobs.companyId, company.id), eq(schema.jobs.source, 'hr')));

  const isHe = locale === 'he';

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div className="flex items-center gap-4">
        {company.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logoUrl}
            alt={company.name}
            className="h-16 w-16 rounded-lg object-contain"
          />
        )}
        <div>
          <h1 className="text-4xl font-bold">{company.name}</h1>
          {company.websiteUrl && (
            <a
              href={company.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 underline"
            >
              {company.websiteUrl}
            </a>
          )}
        </div>
      </div>

      {company.description && (
        <p className="leading-relaxed text-neutral-600">{company.description}</p>
      )}

      <section>
        <h2 className="mb-4 text-2xl font-semibold">{isHe ? 'משרות פתוחות' : 'Open positions'}</h2>

        {activeJobs.length === 0 ? (
          <p className="text-neutral-500">
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
                      <p className="text-sm text-neutral-500">
                        {job.location ?? (isHe ? 'מיקום לא צוין' : 'Location not specified')}
                        {job.remote && ` · ${isHe ? 'מרחוק' : 'Remote'}`}
                        {job.seniority && ` · ${job.seniority}`}
                      </p>
                    </div>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
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
  );
}
