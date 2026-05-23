import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
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
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminRoleSelect } from '@/components/admin-role-select';

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  // Admin gate
  const caller = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: { role: true },
  });
  if (caller?.role !== 'admin') notFound();

  // Fetch target + their data
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
  });
  if (!user) notFound();

  const [userResumes, userGenerations, userAuditEvents, userCoverLetters] = await Promise.all([
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
        className="hover:text-brand-600 inline-flex items-center gap-1 text-sm text-neutral-600 transition"
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
                <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                  <ShieldAlert className="h-3 w-3" />
                  Soft-deleted {new Date(user.deletedAt).toLocaleString()}
                </div>
              )}
            </div>
            <AdminRoleSelect userId={user.id} currentRole={user.role} />
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

      {/* Resumes + Cover letters side-by-side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent resumes</CardTitle>
          </CardHeader>
          <CardContent>
            {userResumes.length === 0 ? (
              <p className="text-sm text-neutral-500">None</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {userResumes.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-neutral-500">
                        {r.locale.toUpperCase()} · {r.industry ?? 'general'}
                      </p>
                    </div>
                    <span className="text-xs text-neutral-500" dir="ltr">
                      {new Date(r.updatedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent cover letters</CardTitle>
          </CardHeader>
          <CardContent>
            {userCoverLetters.length === 0 ? (
              <p className="text-sm text-neutral-500">None</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {userCoverLetters.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="line-clamp-1 font-medium">{l.title}</p>
                      <p className="text-xs text-neutral-500">
                        {l.locale.toUpperCase()} · {l.tone}
                      </p>
                    </div>
                    <span className="text-xs text-neutral-500" dir="ltr">
                      {new Date(l.updatedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent generations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent generations</CardTitle>
          <CardDescription>Last 10 LLM calls</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {userGenerations.length === 0 ? (
            <p className="text-sm text-neutral-500">None</p>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Generations for this user</caption>
              <thead className="text-start text-xs uppercase text-neutral-500">
                <tr className="border-b border-neutral-200">
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
              <tbody className="divide-y divide-neutral-100">
                {userGenerations.map((g) => (
                  <tr key={g.id}>
                    <td className="py-2 ps-1 text-xs text-neutral-500" dir="ltr">
                      {new Date(g.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 font-mono text-xs" dir="ltr">
                      {g.model.replace('claude-', '')}
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
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
                    <td className="py-2 text-xs text-neutral-500" dir="ltr">
                      {g.durationMs ? `${(g.durationMs / 1000).toFixed(1)}s` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Audit timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit timeline</CardTitle>
          <CardDescription>Last 20 events</CardDescription>
        </CardHeader>
        <CardContent>
          {userAuditEvents.length === 0 ? (
            <p className="text-sm text-neutral-500">No events recorded</p>
          ) : (
            <ul className="space-y-2">
              {userAuditEvents.map((e) => (
                <li key={e.id} className="flex items-start gap-3 text-sm">
                  <span className="font-mono text-xs text-neutral-400" dir="ltr">
                    {new Date(e.createdAt).toLocaleTimeString()}
                  </span>
                  <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs">
                    {e.event}
                  </span>
                  {e.metadata != null && (
                    <details className="text-xs text-neutral-600">
                      <summary className="cursor-pointer hover:text-neutral-900">metadata</summary>
                      <pre className="mt-1 max-w-xl overflow-x-auto rounded bg-neutral-50 p-2 text-[10px]">
                        {JSON.stringify(e.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</dt>
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
          <div className="bg-brand-50 text-brand-600 flex h-10 w-10 items-center justify-center rounded-lg">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
