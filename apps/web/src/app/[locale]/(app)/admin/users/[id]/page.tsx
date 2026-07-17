import { notFound } from 'next/navigation';
import { and, eq, desc, isNull } from 'drizzle-orm';
import {
  ArrowLeft,
  Mail,
  FileText,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
} from 'lucide-react';
import { db, schema } from '@/db';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminRoleSelect } from '@/components/admin-role-select';
import { AdminTierSelect } from '@/components/admin-tier-select';
import { AdminFeatureFlags } from '@/components/admin-feature-flags';
import { getUserTier } from '@/lib/billing/tier';
import { requireAdminPage } from '@/lib/auth-guards';
import { AdminUserQuickActions } from '@/components/admin-user-quick-actions';

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Defense-in-depth admin gate (the layout also checks)
  await requireAdminPage();

  // Fetch target + their data
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
  });
  if (!user) notFound();

  const [userResumes, userGenerations, userAuditEvents, userCoverLetters, userTier, subscription] =
    await Promise.all([
      db.query.resumes.findMany({
        where: and(eq(schema.resumes.userId, id), isNull(schema.resumes.deletedAt)),
        orderBy: [desc(schema.resumes.updatedAt)],
        limit: 10,
      }),
      db.query.generations.findMany({
        where: eq(schema.generations.userId, id),
        orderBy: [desc(schema.generations.createdAt)],
        limit: 10,
      }),
      db.query.auditLog.findMany({
        where: eq(schema.auditLog.userId, id),
        orderBy: [desc(schema.auditLog.createdAt)],
        limit: 20,
      }),
      db.query.coverLetters.findMany({
        where: and(eq(schema.coverLetters.userId, id), isNull(schema.coverLetters.deletedAt)),
        orderBy: [desc(schema.coverLetters.updatedAt)],
        limit: 10,
      }),
      getUserTier(id),
      db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.userId, id),
        columns: {
          tier: true,
          status: true,
          provider: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          grantedBy: true,
          notes: true,
        },
      }),
    ]);

  // Token total
  const totalTokens = userGenerations.reduce(
    (sum, g) => sum + (g.promptTokens ?? 0) + (g.completionTokens ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="hover:text-brand-600 text-muted-foreground ease-snappy hover:bg-accent/60 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-all duration-200"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        Back to admin
      </Link>

      {/* User identity */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{user.name ?? '—'}</CardTitle>
              <CardDescription className="mt-1 font-mono" dir="ltr">
                {user.email}
              </CardDescription>
              {user.deletedAt && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                  <ShieldAlert className="h-3 w-3" />
                  Soft-deleted {new Date(user.deletedAt).toLocaleString()}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <AdminRoleSelect userId={user.id} currentRole={user.role} />
              <AdminTierSelect userId={user.id} currentTier={userTier} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Field
              label="ID"
              value={
                <span className="font-mono text-xs" dir="ltr">
                  {user.id}
                </span>
              }
            />
            <Field
              label="Email verified"
              value={
                user.emailVerified ? (
                  <span className="text-emerald-600">
                    <CheckCircle2 className="me-1 inline h-4 w-4" /> Yes
                  </span>
                ) : (
                  <span className="text-amber-600">
                    <XCircle className="me-1 inline h-4 w-4" /> No
                  </span>
                )
              }
            />
            <Field label="Joined" value={new Date(user.createdAt).toLocaleString()} />
            <Field label="Last updated" value={new Date(user.updatedAt).toLocaleString()} />
          </dl>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile Icon={FileText} label="Resumes" value={userResumes.length} />
        <StatTile Icon={Mail} label="Cover letters" value={userCoverLetters.length} />
        <StatTile Icon={Sparkles} label="Generations" value={userGenerations.length} />
        <StatTile Icon={Clock} label="Tokens used" value={totalTokens.toLocaleString()} />
      </div>

      {/* Quick admin actions */}
      <AdminUserQuickActions userId={user.id} subscription={subscription ?? null} />

      {/* Subscription detail + feature flags side-by-side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription</CardTitle>
            <CardDescription>Current plan + lifecycle</CardDescription>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Field
                  label="Tier"
                  value={<span className="font-medium">{subscription.tier}</span>}
                />
                <Field
                  label="Status"
                  value={<span className="font-medium">{subscription.status}</span>}
                />
                <Field label="Provider" value={subscription.provider} />
                <Field
                  label="Renews / ends"
                  value={
                    subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                      : '—'
                  }
                />
                <Field
                  label="Cancel at period end"
                  value={subscription.cancelAtPeriodEnd ? 'Yes' : 'No'}
                />
                <Field
                  label="Granted by"
                  value={subscription.grantedBy ? subscription.grantedBy.slice(0, 8) + '…' : '—'}
                />
                {subscription.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                      Notes
                    </dt>
                    <dd className="text-foreground mt-1">{subscription.notes}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-muted-foreground text-sm">
                No subscription row (treated as free).
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature flags</CardTitle>
            <CardDescription>Per-user feature toggles (job-hunt beta, etc.)</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminFeatureFlags userId={user.id} initial={user.featureFlags ?? {}} />
          </CardContent>
        </Card>
      </div>

      {/* Resumes + Cover letters side-by-side — glass-subtle list wrappers,
          flat rows (a simple bg tint on hover, no lift) since these are
          scannable lists rather than page-level chrome. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-subtle overflow-hidden rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Recent resumes</CardTitle>
          </CardHeader>
          <CardContent>
            {userResumes.length === 0 ? (
              <p className="text-muted-foreground text-sm">None</p>
            ) : (
              <ul className="divide-border divide-y">
                {userResumes.map((r) => (
                  <li
                    key={r.id}
                    className="hover:bg-accent/40 -mx-2 flex items-center justify-between rounded-lg px-2 py-2 text-sm transition-colors"
                  >
                    <div>
                      <p className="font-medium">{r.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {r.locale.toUpperCase()} · {r.industry ?? 'general'}
                      </p>
                    </div>
                    <span className="text-muted-foreground text-xs" dir="ltr">
                      {new Date(r.updatedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </div>

        <div className="glass-subtle overflow-hidden rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Recent cover letters</CardTitle>
          </CardHeader>
          <CardContent>
            {userCoverLetters.length === 0 ? (
              <p className="text-muted-foreground text-sm">None</p>
            ) : (
              <ul className="divide-border divide-y">
                {userCoverLetters.map((l) => (
                  <li
                    key={l.id}
                    className="hover:bg-accent/40 -mx-2 flex items-center justify-between rounded-lg px-2 py-2 text-sm transition-colors"
                  >
                    <div>
                      <p className="line-clamp-1 font-medium">{l.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {l.locale.toUpperCase()} · {l.tone}
                      </p>
                    </div>
                    <span className="text-muted-foreground text-xs" dir="ltr">
                      {new Date(l.updatedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </div>
      </div>

      {/* Recent generations — glass-subtle, no hover-lift table wrapper */}
      <div className="glass-subtle overflow-hidden rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Recent generations</CardTitle>
          <CardDescription>Last 10 LLM calls</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {userGenerations.length === 0 ? (
            <p className="text-muted-foreground text-sm">None</p>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Generations for this user</caption>
              <thead className="text-muted-foreground text-start text-xs uppercase">
                <tr className="border-border border-b">
                  <th scope="col" className="pb-2 ps-1 font-medium">
                    When
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Model
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Status
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Tokens
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {userGenerations.map((g) => (
                  <tr key={g.id} className="hover:bg-accent/40 transition-colors">
                    <td className="text-muted-foreground py-2 ps-1 text-xs" dir="ltr">
                      {new Date(g.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 font-mono text-xs" dir="ltr">
                      {g.model.replace('claude-', '')}
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          g.status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : g.status === 'rejected_input'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td className="py-2 text-xs" dir="ltr">
                      {((g.promptTokens ?? 0) + (g.completionTokens ?? 0)).toLocaleString()}
                    </td>
                    <td className="text-muted-foreground py-2 text-xs" dir="ltr">
                      {g.durationMs ? `${(g.durationMs / 1000).toFixed(1)}s` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </div>

      {/* Audit timeline — glass-subtle, flat rows */}
      <div className="glass-subtle overflow-hidden rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Audit timeline</CardTitle>
          <CardDescription>Last 20 events</CardDescription>
        </CardHeader>
        <CardContent>
          {userAuditEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">No events recorded</p>
          ) : (
            <ul className="space-y-1">
              {userAuditEvents.map((e) => (
                <li
                  key={e.id}
                  className="hover:bg-accent/40 -mx-2 flex items-start gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors"
                >
                  <span className="text-muted-foreground font-mono text-xs" dir="ltr">
                    {new Date(e.createdAt).toLocaleTimeString()}
                  </span>
                  <span className="bg-muted rounded-full px-2 py-0.5 font-mono text-xs">
                    {e.event}
                  </span>
                  {e.metadata != null && (
                    <details className="text-muted-foreground text-xs">
                      <summary className="hover:text-foreground cursor-pointer">metadata</summary>
                      <pre className="bg-muted mt-1 max-w-xl overflow-x-auto rounded-lg p-2 text-[10px]">
                        {JSON.stringify(e.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}

function StatTile({
  Icon,
  label,
  value,
}: {
  Icon: typeof FileText;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="bg-brand-50 text-brand-600 flex h-10 w-10 items-center justify-center rounded-xl">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              {label}
            </p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
