import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { eq, desc, count, isNull, and } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null; // layout already redirects, but appease TS

  const userId = session.user.id;
  const t = await getTranslations('dashboard');

  // Fetch user stats
  const [resumesCount] = await db
    .select({ value: count() })
    .from(schema.resumes)
    .where(and(eq(schema.resumes.userId, userId), isNull(schema.resumes.deletedAt)));

  const [generationsCount] = await db
    .select({ value: count() })
    .from(schema.generations)
    .where(eq(schema.generations.userId, userId));

  const recentResumes = await db.query.resumes.findMany({
    where: and(eq(schema.resumes.userId, userId), isNull(schema.resumes.deletedAt)),
    orderBy: [desc(schema.resumes.updatedAt)],
    limit: 5,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-neutral-600">{t('welcome', { name: session.user.name ?? '' })}</p>
        </div>
        <Button asChild size="lg">
          <Link href="/builder">{t('newResumeBtn')}</Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">
              {t('stats.resumes')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{resumesCount?.value ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">
              {t('stats.generations')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{generationsCount?.value ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">
              {t('stats.lastUsed')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {recentResumes[0] ? new Date(recentResumes[0].updatedAt).toLocaleDateString() : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent resumes */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">{t('recent')}</h2>
        {recentResumes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="mb-4 text-neutral-600">{t('noResumes')}</p>
              <Button asChild>
                <Link href="/builder">{t('newResumeBtn')}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentResumes.map((r) => (
              <Card key={r.id} className="cursor-pointer transition hover:shadow-md">
                <Link href={{ pathname: '/builder', query: { id: r.id } }}>
                  <CardHeader>
                    <CardTitle className="text-lg">{r.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-neutral-500">
                      {r.locale.toUpperCase()} · {r.industry ?? 'general'} ·{' '}
                      {new Date(r.updatedAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
