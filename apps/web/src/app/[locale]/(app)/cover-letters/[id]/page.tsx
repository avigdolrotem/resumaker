import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';
import { Mail, ArrowLeft, ArrowRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CoverLetterActions } from '@/components/cover-letter-actions';
import type { Locale } from '@/i18n/routing';

export default async function CoverLetterDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: Locale }>;
}) {
  const { id, locale } = await params;
  const isHebrew = locale === 'he';

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const letter = await db.query.coverLetters.findFirst({
    where: and(
      eq(schema.coverLetters.id, id),
      eq(schema.coverLetters.userId, session.user.id),
      isNull(schema.coverLetters.deletedAt),
    ),
  });

  if (!letter) notFound();

  const BackIcon = isHebrew ? ArrowRight : ArrowLeft;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/cover-letters"
          className="hover:text-brand-600 inline-flex items-center gap-1 text-sm text-neutral-600 transition"
        >
          <BackIcon className="h-4 w-4" />
          {isHebrew ? 'חזרה למכתבים' : 'All cover letters'}
        </Link>
      </div>

      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{letter.title}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-purple-50 px-2 py-0.5 font-medium text-purple-700">
                {letter.locale.toUpperCase()}
              </span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600">
                {letter.tone}
              </span>
              {letter.companyName && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600">
                  {letter.companyName}
                </span>
              )}
              <span className="text-neutral-500">
                {new Date(letter.createdAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
          <CoverLetterActions id={letter.id} content={letter.content} isHebrew={isHebrew} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            {isHebrew ? 'המכתב' : 'The letter'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800"
            dir={letter.locale === 'he' ? 'rtl' : 'ltr'}
          >
            {letter.content}
          </div>
        </CardContent>
      </Card>

      {letter.jobDescription && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isHebrew ? 'תיאור המשרה' : 'Original job description'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <details className="text-sm">
              <summary className="hover:text-brand-600 cursor-pointer text-neutral-600">
                {isHebrew ? 'הצג' : 'Show'}
              </summary>
              <div className="mt-3 whitespace-pre-wrap text-neutral-700">
                {letter.jobDescription}
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link href="/cover-letters/new">{isHebrew ? 'מכתב חדש' : 'New letter'}</Link>
        </Button>
      </div>
    </div>
  );
}
