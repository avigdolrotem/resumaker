import { notFound } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { headers } from 'next/headers';
import { ChevronLeft, Download } from 'lucide-react';
import { db, schema } from '@/db';
import { Link } from '@/i18n/navigation';
import { ResumeInlineEditor } from '@/components/resume-inline-editor';
import { requireActiveUser } from '@/lib/auth-guards';
import { NextResponse } from 'next/server';

/**
 * /[locale]/(app)/resumes/[id]/edit — full inline editor route.
 *
 * Loads the resume server-side, hands it to a client editor which lets
 * the user mutate every field + reorder sections. Save writes through
 * PATCH /api/resumes/[id] (which snapshots a version first).
 */
export default async function EditResumePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) return null;

  const resume = await db.query.resumes.findFirst({
    where: and(
      eq(schema.resumes.id, id),
      eq(schema.resumes.userId, guard.user.id),
      isNull(schema.resumes.deletedAt),
    ),
  });
  if (!resume) notFound();

  const isHebrew = locale === 'he';

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-2 py-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/builder?id=${id}`}
          className="text-muted-foreground ease-snappy inline-flex items-center gap-1 text-sm transition-colors duration-200 hover:text-violet-700"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          {isHebrew ? 'חזרה לבונה' : 'Back to builder'}
        </Link>
        <div className="flex gap-2 text-sm">
          <a
            href={`/api/resumes/${id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="glass hover:glass-strong ease-snappy inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 transition-all duration-200 active:scale-[0.96]"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </a>
          <a
            href={`/api/resumes/${id}/export?format=docx`}
            className="glass hover:glass-strong ease-snappy inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 transition-all duration-200 active:scale-[0.96]"
          >
            <Download className="h-3.5 w-3.5" />
            DOC
          </a>
          <a
            href={`/api/resumes/${id}/export?format=txt`}
            className="glass hover:glass-strong ease-snappy inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 transition-all duration-200 active:scale-[0.96]"
          >
            <Download className="h-3.5 w-3.5" />
            TXT
          </a>
          <a
            href={`/api/resumes/${id}/export?format=json`}
            className="glass hover:glass-strong ease-snappy inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 transition-all duration-200 active:scale-[0.96]"
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </a>
        </div>
      </div>

      <ResumeInlineEditor
        resumeId={id}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialContent={resume.content as any}
        isHebrew={isHebrew}
      />
    </div>
  );
}
