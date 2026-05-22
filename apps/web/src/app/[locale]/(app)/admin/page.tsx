import { db, schema } from '@/db';
import { desc, count, sum } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AdminPage() {
  // Top stats
  const [usersStat] = await db.select({ value: count() }).from(schema.users);
  const [genStat] = await db.select({ value: count() }).from(schema.generations);
  const [tokenStat] = await db
    .select({
      input: sum(schema.generations.promptTokens),
      output: sum(schema.generations.completionTokens),
    })
    .from(schema.generations);

  const recentUsers = await db.query.users.findMany({
    orderBy: [desc(schema.users.createdAt)],
    limit: 10,
  });

  const recentGenerations = await db.query.generations.findMany({
    orderBy: [desc(schema.generations.createdAt)],
    limit: 10,
  });

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Admin</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{usersStat?.value ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">Generations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{genStat?.value ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">Tokens used</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {(Number(tokenStat?.input ?? 0) + Number(tokenStat?.output ?? 0)).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent users</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="pb-2">Email</th>
                <th className="pb-2">Name</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {recentUsers.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 font-mono text-xs">{u.email}</td>
                  <td className="py-2">{u.name ?? '—'}</td>
                  <td className="py-2">{u.role}</td>
                  <td className="py-2 text-neutral-500">
                    {new Date(u.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent generations</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="pb-2">When</th>
                <th className="pb-2">User</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Tokens</th>
                <th className="pb-2">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {recentGenerations.map((g) => (
                <tr key={g.id}>
                  <td className="py-2 text-xs text-neutral-500">
                    {new Date(g.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 font-mono text-xs">{g.userId.slice(0, 8)}</td>
                  <td className="py-2">
                    <span
                      className={
                        g.status === 'success'
                          ? 'rounded bg-green-100 px-2 py-0.5 text-xs text-green-700'
                          : 'rounded bg-red-100 px-2 py-0.5 text-xs text-red-700'
                      }
                    >
                      {g.status}
                    </span>
                  </td>
                  <td className="py-2 text-xs">
                    {(g.promptTokens ?? 0) + (g.completionTokens ?? 0)}
                  </td>
                  <td className="py-2 text-xs text-neutral-500">
                    {g.durationMs ? `${g.durationMs}ms` : '—'}
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
