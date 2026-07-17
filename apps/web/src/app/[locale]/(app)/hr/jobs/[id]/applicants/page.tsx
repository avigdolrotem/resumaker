import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireActiveUser } from '@/lib/auth-guards';
import { NextResponse } from 'next/server';

export default async function ApplicantsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
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
    .where(and(eq(schema.applications.jobId, id), eq(schema.applications.notifyRecruiter, true)));

  const isHe = locale === 'he';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{isHe ? 'מועמדים' : 'Applicants'}</h1>
        <p className="text-muted-foreground mt-1">
          {job.title} — {isHe ? 'מועמדים שנתנו הסכמה' : 'applicants who opted in'}
        </p>
      </div>

      {applicants.length === 0 ? (
        <div className="glass-subtle text-muted-foreground border-border rounded-2xl border-2 border-dashed py-16 text-center">
          {isHe ? 'אין מועמדים שנתנו הסכמה עדיין.' : 'No opted-in applicants yet.'}
        </div>
      ) : (
        // Flat, scannable list — glass-subtle wrapper, no per-row hover-lift
        // (dense list of applicants, per the admin design note).
        <div className="glass-subtle overflow-hidden rounded-2xl">
          <ul className="divide-border divide-y">
            {applicants.map((a) => (
              <li
                key={a.applicationId}
                className="hover:bg-accent/40 space-y-1 px-6 py-4 transition-colors"
              >
                <p className="font-medium">{(a.name ?? isHe) ? 'ללא שם' : 'No name'}</p>
                <p className="text-muted-foreground text-sm">{a.email}</p>
                <p className="text-muted-foreground text-xs">
                  {isHe ? 'סטטוס: ' : 'Status: '}
                  <span className="bg-muted rounded-full px-2 py-0.5 font-medium">{a.status}</span>
                  {a.appliedAt && (
                    <span className="ms-2">
                      {isHe ? '· הגיש/ה ב' : '· Applied '}
                      {new Date(a.appliedAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
