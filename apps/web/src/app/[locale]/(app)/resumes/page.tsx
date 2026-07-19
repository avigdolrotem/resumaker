import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { and, eq, desc, isNull } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { ResumeGrid } from '@/components/resume-grid';
import { getLatestScoresByResumeId } from '@/lib/ats-score-lookup';
import { Plus } from 'lucide-react';

/**
 * Full "My Resumes" list — the dashboard only ever showed the 6 most
 * recently updated (a fixed-size widget, not a list view), and its
 * "All resumes →" link pointed at a blank /builder instead of anywhere
 * that actually listed the rest. Reuses ResumeGrid as-is (search,
 * delete, duplicate, PDF download already built in) rather than a
 * second bespoke listing — same component, just fed every resume
 * instead of a 6-row slice.
 */
export default async function ResumesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const isHebrew = (await getLocale()) === 'he';
  const userId = session.user.id;

  const resumes = await db.query.resumes.findMany({
    where: and(eq(schema.resumes.userId, userId), isNull(schema.resumes.deletedAt)),
    orderBy: [desc(schema.resumes.updatedAt)],
    columns: { id: true, title: true, locale: true, industry: true, updatedAt: true },
  });

  const scoresByResumeId = await getLatestScoresByResumeId(resumes.map((r) => r.id));
  const rows = resumes.map((r) => ({
    ...r,
    atsScore: scoresByResumeId.get(r.id) ?? null,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isHebrew ? 'קורות החיים שלי' : 'My resumes'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isHebrew ? `${resumes.length} קורות חיים שמורים` : `${resumes.length} saved`}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/builder">
            <Plus className="me-2 h-4 w-4" />
            {isHebrew ? 'קורות חיים חדשים' : 'New resume'}
          </Link>
        </Button>
      </div>

      <ResumeGrid resumes={rows} isHebrew={isHebrew} />
    </div>
  );
}
