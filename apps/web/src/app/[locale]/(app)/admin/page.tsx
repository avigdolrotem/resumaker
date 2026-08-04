import { db, schema } from '@/db';
import { desc, count, sum, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminUserSearch } from '@/components/admin-user-search';
import { Users, FileText, Coins, Activity, AlertTriangle } from 'lucide-react';
import { requireAdminPage } from '@/lib/auth-guards';

export default async function AdminPage() {
  // Page-level admin gate — defense in depth so a layout refactor can't
  // quietly leak the queries below.
  await requireAdminPage();

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
      // `.toISOString()` + an explicit cast, NOT a bare Date. Inside a raw
      // `sql` fragment there is no column type for Drizzle to infer the
      // parameter from, so postgres-js receives a JS Date it can't
      // serialize and the whole query throws — taking the entire admin
      // dashboard down with it, since this runs in the page's server
      // component. Typed helpers like gte() bind Dates fine; raw
      // fragments do not.
      sql`${schema.generations.status} != 'success' AND ${schema.generations.createdAt} >= ${day.toISOString()}::timestamptz`,
    );

  const recentUsers = await db.query.users.findMany({
    orderBy: [desc(schema.users.createdAt)],
    limit: 50,
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
        <p className="text-muted-foreground">System metrics + recent activity</p>
      </div>

      {/* Top metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          Icon={Users}
          label="Users"
          value={(usersStat?.value ?? 0).toLocaleString()}
          delta={usersTodayStat?.value ? `+${usersTodayStat.value} today` : undefined}
          color="from-brand-500 to-brand-700"
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
          color="from-accent-500 to-accent-700"
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

      {/* Users table (searchable, filterable) — glass-subtle, no hover-lift:
          dense scan surface stays flat + fast per the admin design note. */}
      <div className="glass-subtle overflow-hidden rounded-2xl">
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Last 50 sign-ups — searchable + role-filterable</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminUserSearch users={recentUsers} />
        </CardContent>
      </div>

      {/* Generations table */}
      <div className="glass-subtle overflow-hidden rounded-2xl">
        <CardHeader>
          <CardTitle>Recent generations</CardTitle>
          <CardDescription>Last 15 LLM calls</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Recent LLM generations</caption>
            <thead className="text-muted-foreground text-start text-xs uppercase">
              <tr className="border-border border-b">
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
            <tbody className="divide-border divide-y">
              {recentGenerations.map((g) => (
                <tr key={g.id} className="hover:bg-accent/40 transition-colors">
                  <td className="text-muted-foreground py-2 ps-1 text-xs">
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
                  <td className="text-muted-foreground py-2 text-xs" dir="ltr">
                    {g.durationMs ? `${(g.durationMs / 1000).toFixed(1)}s` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </div>
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
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              {label}
            </p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {delta && <p className="text-muted-foreground mt-1 text-xs">{delta}</p>}
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ${color}`}
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
      ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-200'
      : status === 'rejected_input'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200'
        : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-200';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{status}</span>;
}
