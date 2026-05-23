import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { eq, desc, count, isNull, and, gte, sql } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResumeGrid } from '@/components/resume-grid';
import {
  FileText,
  Sparkles,
  Mail,
  Plus,
  Clock,
  TrendingUp,
  ArrowRight,
  Briefcase,
  Target,
} from 'lucide-react';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const userId = session.user.id;
  const t = await getTranslations('dashboard');
  const isHebrew = (await headers()).get('x-locale') === 'he';

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Stats — parallel
  const [
    [resumesCount],
    [generationsCount],
    [recentGensCount],
    [avgScoreRow],
    recentResumes,
    recentActivity,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(schema.resumes)
      .where(and(eq(schema.resumes.userId, userId), isNull(schema.resumes.deletedAt))),
    db
      .select({ value: count() })
      .from(schema.generations)
      .where(eq(schema.generations.userId, userId)),
    db
      .select({ value: count() })
      .from(schema.generations)
      .where(
        and(eq(schema.generations.userId, userId), gte(schema.generations.createdAt, weekAgo)),
      ),
    db
      .select({ avg: sql<number>`COALESCE(AVG(${schema.atsScores.overall})::int, 0)` })
      .from(schema.atsScores)
      .innerJoin(schema.resumes, eq(schema.atsScores.resumeId, schema.resumes.id))
      .where(eq(schema.resumes.userId, userId)),
    db.query.resumes.findMany({
      where: and(eq(schema.resumes.userId, userId), isNull(schema.resumes.deletedAt)),
      orderBy: [desc(schema.resumes.updatedAt)],
      limit: 6,
    }),
    db.query.generations.findMany({
      where: eq(schema.generations.userId, userId),
      orderBy: [desc(schema.generations.createdAt)],
      limit: 8,
      columns: { id: true, model: true, status: true, durationMs: true, createdAt: true },
    }),
  ]);

  const stats = {
    resumes: resumesCount?.value ?? 0,
    generations: generationsCount?.value ?? 0,
    weekGens: recentGensCount?.value ?? 0,
    avgScore: avgScoreRow?.avg ?? 0,
  };

  const userName = session.user.name ?? session.user.email.split('@')[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isHebrew ? `שלום ${userName} 👋` : `Hi ${userName} 👋`}
          </h1>
          <p className="mt-1 text-neutral-600">{t('title')}</p>
        </div>
        <Button asChild size="lg">
          <Link href="/builder">
            <Plus className="me-2 h-4 w-4" />
            {t('newResumeBtn')}
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          Icon={FileText}
          label={t('stats.resumes')}
          value={stats.resumes.toString()}
          gradient="from-blue-500 to-blue-700"
        />
        <StatCard
          Icon={Sparkles}
          label={t('stats.generations')}
          value={stats.generations.toString()}
          delta={
            stats.weekGens > 0
              ? `+${stats.weekGens} ${isHebrew ? 'השבוע' : 'this week'}`
              : undefined
          }
          gradient="from-purple-500 to-purple-700"
        />
        <StatCard
          Icon={Target}
          label={isHebrew ? 'ניקוד ATS ממוצע' : 'Avg ATS score'}
          value={stats.avgScore > 0 ? `${stats.avgScore}` : '—'}
          gradient="from-emerald-500 to-emerald-700"
        />
        <StatCard
          Icon={Clock}
          label={t('stats.lastUsed')}
          value={
            recentResumes[0]
              ? new Date(recentResumes[0].updatedAt).toLocaleDateString(
                  isHebrew ? 'he-IL' : 'en-US',
                  {
                    month: 'short',
                    day: 'numeric',
                  },
                )
              : '—'
          }
          gradient="from-amber-500 to-amber-700"
        />
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <QuickAction
          Icon={FileText}
          title={isHebrew ? 'קורות חיים חדשים' : 'New resume'}
          description={isHebrew ? 'הדבק משרה, קבל קורות חיים' : 'Paste a JD, get a tailored resume'}
          href="/builder"
          gradient="from-brand-500/10 to-brand-700/10"
          iconColor="text-brand-600"
        />
        <QuickAction
          Icon={Mail}
          title={isHebrew ? 'מכתב הצעה' : 'Cover letter'}
          description={isHebrew ? 'מכתב מותאם לכל משרה' : 'Tailored cover letter for any role'}
          href="/cover-letters/new"
          gradient="from-purple-500/10 to-purple-700/10"
          iconColor="text-purple-600"
        />
        <QuickAction
          Icon={Briefcase}
          title={isHebrew ? 'ראה דוגמאות' : 'See examples'}
          description={isHebrew ? '4 דוגמאות מעוצבות' : '4 polished sample resumes'}
          href="/examples"
          gradient="from-emerald-500/10 to-emerald-700/10"
          iconColor="text-emerald-600"
        />
      </div>

      {/* Recent resumes (filterable) */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t('recent')}</h2>
          {recentResumes.length > 0 && (
            <Link
              href="/builder"
              className="text-brand-600 hover:text-brand-700 text-sm font-medium"
            >
              {isHebrew ? 'כל קורות החיים' : 'All resumes'} →
            </Link>
          )}
        </div>
        <ResumeGrid resumes={recentResumes} isHebrew={isHebrew} />
      </section>

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              {isHebrew ? 'פעילות אחרונה' : 'Recent activity'}
            </CardTitle>
            <CardDescription>
              {isHebrew ? 'יצירות AI אחרונות שלך' : 'Your recent AI generations'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-neutral-100">
              {recentActivity.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        a.status === 'success'
                          ? 'bg-emerald-100 text-emerald-600'
                          : a.status === 'rejected_input'
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-red-100 text-red-600'
                      }`}
                    >
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {a.status === 'success'
                          ? isHebrew
                            ? 'יצירה הצליחה'
                            : 'Generation succeeded'
                          : a.status === 'rejected_input'
                            ? isHebrew
                              ? 'נחסם על ידי הגנה'
                              : 'Blocked by safety'
                            : isHebrew
                              ? 'יצירה נכשלה'
                              : 'Generation failed'}
                      </p>
                      <p className="text-xs text-neutral-500" dir="ltr">
                        {a.model.replace('claude-', '')} ·{' '}
                        {a.durationMs ? `${(a.durationMs / 1000).toFixed(1)}s` : 'n/a'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-neutral-500" dir="ltr">
                    {new Date(a.createdAt).toLocaleString(isHebrew ? 'he-IL' : 'en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  Icon,
  label,
  value,
  delta,
  gradient,
}: {
  Icon: typeof FileText;
  label: string;
  value: string;
  delta?: string | undefined;
  gradient: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
            <p className="mt-1 text-3xl font-bold">{value}</p>
            {delta && <p className="mt-1 text-xs text-emerald-600">{delta}</p>}
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-md ${gradient}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  Icon,
  title,
  description,
  href,
  gradient,
  iconColor,
}: {
  Icon: typeof FileText;
  title: string;
  description: string;
  href: '/builder' | '/cover-letters/new' | '/examples';
  gradient: string;
  iconColor: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card
        className={`relative h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md`}
      >
        <div
          aria-hidden
          className={`absolute inset-0 bg-gradient-to-br opacity-50 transition group-hover:opacity-100 ${gradient}`}
        />
        <CardContent className="relative pt-6">
          <div className="flex items-start justify-between">
            <Icon className={`h-8 w-8 ${iconColor}`} />
            <ArrowRight className="h-4 w-4 text-neutral-400 transition group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </div>
          <h3 className="mt-4 text-base font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-neutral-600">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
