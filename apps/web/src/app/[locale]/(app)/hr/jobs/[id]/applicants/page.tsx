import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';
import { Card, CardContent } from '@/components/ui/card';
import { NextResponse } from 'next/server';

export default async function ApplicantsPage({
  params,
}: {
  params: Promise<{ locale: 'he' | 'en'; id: string }>;
}) {
  const { locale, id } = await params;

  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) redirect('/sign-in');
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') redirect('/dashboard');

  const job = await db.query.jobs.findFirst({
    where: and(eq(schema.jobs.id, id), eq(schema.jobs.source, 'hr')),
  });

  if (!job || (guard.user.role !== 'admin' && job.hrUserId !== guard.user.id)) {
    redirect('/hr/jobs');
  }

  const applicants = await db
    .select({
      applicationId: schema.applications.id,
      status: schema.applications.status,
      appliedAt: schema.applications.appliedAt,
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.applications)
    .innerJoin(schema.users, eq(schema.applications.userId, schema.users.id))
    .where(
      and(eq(schema.applications.jobId, id), eq(schema.applications.notifyRecruiter, true)),
    );

  const isHe = locale === 'he';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{isHe ? 'מועמדים' : 'Applicants'}</h1>
        <p className="text-neutral-600 mt-1">
          {job.title} — {isHe ? 'מועמדים שנתנו הסכמה' : 'applicants who opted in'}
        </p>
      </div>

      {applicants.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-neutral-500">
            {isHe ? 'אין מועמדים שנתנו הסכמה עדיין.' : 'No opted-in applicants yet.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applicants.map((a) => (
            <Card key={a.applicationId}>
              <CardContent className="pt-5 space-y-1">
                <p className="font-medium">{a.name ?? isHe ? 'ללא שם' : 'No name'}</p>
                <p className="text-sm text-neutral-600">{a.email}</p>
                <p className="text-xs text-neutral-400">
                  {isHe ? 'סטטוס: ' : 'Status: '}
                  {a.status}
                  {a.appliedAt && (
                    <span className="ms-2">
                      {isHe ? '· הגיש/ה ב' : '· Applied '}
                      {new Date(a.appliedAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
