import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { and, eq, desc, isNull } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Plus, ArrowRight } from 'lucide-react';

export default async function CoverLettersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  // Read locale from next-intl, not from a non-existent `x-locale` header.
  const isHebrew = (await getLocale()) === 'he';

  const letters = await db.query.coverLetters.findMany({
    where: and(
      eq(schema.coverLetters.userId, session.user.id),
      isNull(schema.coverLetters.deletedAt),
    ),
    orderBy: [desc(schema.coverLetters.updatedAt)],
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isHebrew ? 'מכתבי הצעה' : 'Cover letters'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isHebrew ? `${letters.length} מכתבים שמורים` : `${letters.length} saved`}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/cover-letters/new">
            <Plus className="me-2 h-4 w-4" />
            {isHebrew ? 'מכתב חדש' : 'New cover letter'}
          </Link>
        </Button>
      </div>

      {letters.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-50">
              <Mail className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">
              {isHebrew ? 'עוד אין לך מכתבים' : 'No cover letters yet'}
            </h3>
            <p className="text-muted-foreground mb-6 text-sm">
              {isHebrew
                ? 'צור מכתב הצעה מותאם לכל משרה תוך שניות'
                : 'Generate a tailored cover letter for any job in seconds'}
            </p>
            <Button asChild>
              <Link href="/cover-letters/new">
                <Plus className="me-2 h-4 w-4" />
                {isHebrew ? 'מכתב ראשון' : 'Create one'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {letters.map((l) => (
            <Link
              key={l.id}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={`/cover-letters/${l.id}` as any}
              className="group block"
            >
              <Card className="hover:border-brand-300 hover:shadow-brand-500/5 h-full transition hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="line-clamp-2 text-base">{l.title}</CardTitle>
                    <ArrowRight className="text-brand-400 group-hover:text-brand-600 h-4 w-4 flex-shrink-0 transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground line-clamp-3 text-sm">
                    {l.content.slice(0, 200)}…
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 font-medium text-purple-700">
                      {l.locale.toUpperCase()}
                    </span>
                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium">
                      {l.tone}
                    </span>
                    {l.companyName && (
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium">
                        {l.companyName}
                      </span>
                    )}
                    <span className="text-muted-foreground ms-auto">
                      {new Date(l.updatedAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
