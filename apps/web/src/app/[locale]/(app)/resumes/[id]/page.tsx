import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { getTranslations, getLocale } from 'next-intl/server';
import { requireActiveUser } from '@/lib/auth-guards';
import { db, schema } from '@/db';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { ResumePreview } from '@/components/resume-preview';
import { AtsScoreCard } from '@/components/ats-score-card';
import { ArrowLeft, ArrowRight, Download } from 'lucide-react';
import type { Resume } from '@resumaker/shared';
import { DeleteResumeButton } from './delete-resume-button';

/**
 * /resumes/[id] — read-only view of a generated resume: preview, ATS
 * score (if scored), download, delete.
 *
 * Replaces the old behavior of clicking a resume card, which used to
 * reopen the full per-resume editor at /builder?id= — that editor no
 * longer exists (content is generated from the shared career profile,
 * not hand-edited per resume), so this is a view, not an edit surface.
 */
export default async function ResumeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) redirect('/sign-in');

  const resume = await db.query.resumes.findFirst({
    where: and(
      eq(schema.resumes.id, id),
      eq(schema.resumes.userId, guard.user.id),
      isNull(schema.resumes.deletedAt),
    ),
  });
  if (!resume) notFound();

  const scoreRow = await db.query.atsScores.findFirst({
    where: eq(schema.atsScores.resumeId, id),
    orderBy: [desc(schema.atsScores.createdAt)],
  });

  const t = await getTranslations('resumeDetail');
  const isHebrew = (await getLocale()) === 'he';
  const content = resume.content as Resume;
  const BackIcon = isHebrew ? ArrowRight : ArrowLeft;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/resumes"
        className="text-muted-foreground hover:text-foreground ease-snappy inline-flex items-center gap-1.5 text-sm transition-colors duration-200"
      >
        <BackIcon className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{resume.jobTitle ?? resume.title}</h1>
          {resume.companyName && <p className="text-muted-foreground mt-1">{resume.companyName}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/resumes/${resume.id}/pdf`} target="_blank" rel="noreferrer">
              <Download className="me-1.5 h-3.5 w-3.5" />
              {t('downloadPdf')}
            </a>
          </Button>
          <DeleteResumeButton resumeId={resume.id} isHebrew={isHebrew} />
        </div>
      </div>

      {scoreRow && (
        <AtsScoreCard
          score={{
            overall: scoreRow.overall,
            matched_keywords: scoreRow.matchedKeywords as string[],
            missing_keywords: scoreRow.missingKeywords as string[],
            suggestions: scoreRow.suggestions as Array<{
              type: string;
              severity: string;
              message: string;
            }>,
          }}
          isHebrew={isHebrew}
        />
      )}

      <ResumePreview resume={content} />
    </div>
  );
}
