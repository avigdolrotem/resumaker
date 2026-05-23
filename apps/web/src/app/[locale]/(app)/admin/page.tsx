import { db, schema } from '@/db';
import { desc, count, sum, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminRoleSelect } from '@/components/admin-role-select';
import { Users, FileText, Coins, Activity, AlertTriangle } from 'lucide-react';

export default async function AdminPage() {
  // ─── Stats ───
  const day = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [usersStat] = await db.select({ value: count() }).from(schema.users);
  const [usersTodayStat] = await db
    .select({ value: count() })
    .from(schema.users)
    .where(gte(schema.users.createdAt, day));

  const [genStat] = await db.select({ value: count() }).from(schema.generations);
  const [genTodayStat] = await db
    .select({ value: count() })
    .from(schema.generations)
    .where(gte(schema.generations.createdAt, day));

  const [tokenStat] = await db
    .select({
      input: sum(schema.generations.promptTokens),
      output: sum(schema.generations.completionTokens),
    })
    .from(schema.generations);

  const [failStat] = await db
    .select({ value: count() })
    .from(schema.generations)
    .where(
      sql`${schema.generations.status} != 'success' AND ${schema.generations.createdAt} >= ${day}`,
    );

  const recentUsers = await db.query.users.findMany({
    orderBy: [desc(schema.users.createdAt)],
    limit: 15,
  });

  const recentGenerations = await db.query.generations.findMany({
    orderBy: [desc(schema.generations.createdAt)],
    limit: 15,
  });

  // Cost estimate: rough cents-per-token rate
  const totalTokens = Number(tokenStat?.input ?? 0) + Number(tokenStat?.output ?? 0);
  // Claude Sonnet roughly $3/M input + $15/M output. Use weighted average ≈ $7/M total.
  const estimatedCost = (totalTokens / 1_000_000) * 7;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="text-neutral-600">System metrics + recent activity</p>
      </div>

      {/* Top metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          Icon={Users}
          label="Users"
          value={(usersStat?.value ?? 0).toLocaleString()}
          delta={usersTodayStat?.value ? `+${usersTodayStat.value} today` : undefined}
          color="from-blue-500 to-blue-700"
        />
        <MetricCard
          Icon={FileText}
          label="Generations"
          value={(genStat?.value ?? 0).toLocaleString()}
          delta={genTodayStat?.value ? `+${genTodayStat.value} today` : undefined}
          color="from-emerald-500 to-emerald-700"
        />
        <MetricCard
          Icon={Coins}
          label="Tokens"
          value={totalTokens.toLocaleString()}
          color="from-amber-500 to-amber-700"
        />
        <MetricCard
          Icon={Activity}
          label="Est. cost"
          value={`$${estimatedCost.toFixed(2)}`}
          color="from-purple-500 to-purple-700"
        />
        <MetricCard
          Icon={AlertTriangle}
          label="Failures 24h"
          value={(failStat?.value ?? 0).toLocaleString()}
          color={
            (failStat?.value ?? 0) > 5
              ? 'from-red-500 to-red-700'
              : 'from-neutral-400 to-neutral-600'
          }
        />
      </div>

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent users</CardTitle>
          <CardDescription>Last 15 sign-ups</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Recently registered users</caption>
            <thead className="text-start text-xs uppercase text-neutral-500">
              <tr className="border-b border-neutral-200">
                <th scope="col" className="pb-2 ps-1 font-medium">
                  Email
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Name
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Role
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Verified
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {recentUsers.map((u) => (
                <tr key={u.id} className={u.deletedAt ? 'opacity-50' : ''}>
                  <td className="py-2 ps-1 font-mono text-xs" dir="ltr">
                    {u.email}
                  </td>
                  <td className="py-2">{u.name ?? '—'}</td>
                  <td className="py-2">
                    <AdminRoleSelect userId={u.id} currentRole={u.role} />
                  </td>
                  <td className="py-2 text-xs">
                    {u.emailVerified ? (
                      <span className="text-emerald-600">✓</span>
                    ) : (
                      <span className="text-amber-600">○</span>
                    )}
                  </td>
                  <td className="py-2 text-xs text-neutral-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Generations table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent generations</CardTitle>
          <CardDescription>Last 15 LLM calls</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Recent LLM generations</caption>
            <thead className="text-start text-xs uppercase text-neutral-500">
              <tr className="border-b border-neutral-200">
                <th scope="col" className="pb-2 ps-1 font-medium">
                  When
                </th>
                <th scope="col" className="pb-2 font-medium">
                  User
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
              {recentGenerations.map((g) => (
                <tr key={g.id}>
                  <td className="py-2 ps-1 text-xs text-neutral-500">
                    {new Date(g.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="py-2 font-mono text-xs" dir="ltr">
                    {g.userId.slice(0, 8)}…
                  </td>
                  <td className="py-2 font-mono text-xs" dir="ltr">
                    {g.model.replace('claude-', '')}
                  </td>
                  <td className="py-2">
                    <StatusBadge status={g.status} />
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
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  Icon,
  label,
  value,
  delta,
  color,
}: {
  Icon: typeof Users;
  label: string;
  value: string;
  delta?: string | undefined;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {delta && <p className="mt-1 text-xs text-neutral-600">{delta}</p>}
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-md ${color}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === 'success'
      ? 'bg-green-100 text-green-700'
      : status === 'rejected_input'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700';
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles}`}>{status}</span>;
}
