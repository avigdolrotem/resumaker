import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { requireAdminPage } from '@/lib/auth-guards';
import { ModerationActions } from '@/components/admin-moderation-actions';

/**
 * /admin/moderation — the review queue lib/content-trust.ts and
 * trustedSharerRequests both feed into. Two independent lists: manual
 * job imports from non-trusted submitters (status='pending', excluded
 * from the shared /jobs feed until approved), and requests to become a
 * trusted sharer (approving one sets featureFlags.trustedSharer, which
 * also retroactively means nothing about their *already-submitted*
 * pending jobs — those still need their own approval here).
 */
export default async function AdminModerationPage() {
  await requireAdminPage();

  const pendingJobs = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.title,
      company: schema.jobs.company,
      location: schema.jobs.location,
      url: schema.jobs.url,
      createdAt: schema.jobs.scrapedAt,
      submitterEmail: schema.users.email,
      submitterName: schema.users.name,
    })
    .from(schema.jobs)
    .leftJoin(schema.users, eq(schema.users.id, schema.jobs.submittedByUserId))
    .where(and(eq(schema.jobs.source, 'manual'), eq(schema.jobs.status, 'pending')))
    .orderBy(desc(schema.jobs.scrapedAt));

  const pendingTrustRequests = await db
    .select({
      id: schema.trustedSharerRequests.id,
      note: schema.trustedSharerRequests.note,
      createdAt: schema.trustedSharerRequests.createdAt,
      requesterId: schema.users.id,
      requesterEmail: schema.users.email,
      requesterName: schema.users.name,
    })
    .from(schema.trustedSharerRequests)
    .innerJoin(schema.users, eq(schema.users.id, schema.trustedSharerRequests.userId))
    .where(eq(schema.trustedSharerRequests.status, 'pending'))
    .orderBy(desc(schema.trustedSharerRequests.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Moderation</h1>
        <p className="text-muted-foreground">
          Manual job imports and trusted-sharer requests awaiting review.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending job imports ({pendingJobs.length})</CardTitle>
          <CardDescription>
            Manually-imported jobs from non-trusted users — hidden from the shared /jobs feed until
            approved. Admin and role=&apos;hr&apos; submitters skip this queue entirely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingJobs.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Nothing pending.</p>
          ) : (
            <div className="divide-border divide-y">
              {pendingJobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{j.title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {j.company}
                      {j.location ? ` · ${j.location}` : ''} · submitted by{' '}
                      {j.submitterName ?? j.submitterEmail ?? 'unknown'}
                    </p>
                    <a
                      href={j.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 hover:underline"
                      dir="ltr"
                    >
                      {j.url}
                    </a>
                  </div>
                  <ModerationActions endpoint={`/api/admin/moderation/jobs/${j.id}`} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trusted-sharer requests ({pendingTrustRequests.length})</CardTitle>
          <CardDescription>
            Approving grants featureFlags.trustedSharer — their manual imports publish immediately
            from then on. Doesn&apos;t retroactively approve anything already pending above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingTrustRequests.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Nothing pending.</p>
          ) : (
            <div className="divide-border divide-y">
              {pendingTrustRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.requesterName ?? r.requesterEmail}</p>
                    <p className="text-muted-foreground text-xs" dir="ltr">
                      {r.requesterEmail}
                    </p>
                    <p className="mt-1 text-sm">{r.note}</p>
                  </div>
                  <ModerationActions endpoint={`/api/admin/moderation/trust-requests/${r.id}`} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
