import { requireAdminPage } from '@/lib/auth-guards';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';

async function fetchJson<T>(url: string, baseUrl: string): Promise<T> {
  const res = await fetch(`${baseUrl}${url}`, { cache: 'no-store' });
  return res.json() as Promise<T>;
}

interface DauRow {
  date: string;
  count: number;
}
interface FunnelData {
  signups: number;
  firstResume: number;
  paid: number;
}
interface MrrData {
  mrrIls: number;
  subscriberCount: number;
}
interface CohortRow {
  cohortWeek: string;
  weeks: number[];
}

export default async function AdminAnalyticsPage() {
  await requireAdminPage();

  const base = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';

  const [dauData, funnelData, mrrData, cohortData] = await Promise.all([
    fetchJson<{ rows: DauRow[] }>('/api/admin/analytics/dau', base),
    fetchJson<FunnelData>('/api/admin/analytics/funnel', base),
    fetchJson<MrrData>('/api/admin/analytics/mrr', base),
    fetchJson<{ cohortTable: CohortRow[] }>('/api/admin/analytics/cohort', base),
  ]);

  const dauRows = dauData.rows ?? [];
  const maxCount = Math.max(1, ...dauRows.map((r) => r.count));

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="hover:text-brand-600 inline-flex items-center gap-1 text-sm text-neutral-600 transition"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        Back to admin
      </Link>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Signups (30d)
            </p>
            <p className="text-3xl font-bold">{funnelData.signups}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">MRR</p>
            <p className="text-3xl font-bold">₪{(mrrData.mrrIls ?? 0).toFixed(0)}</p>
            <p className="text-xs text-neutral-500">{mrrData.subscriberCount} subscribers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Funnel (30d)
            </p>
            <p className="text-sm">
              {funnelData.signups} signups → {funnelData.firstResume} resumes → {funnelData.paid}{' '}
              paid
            </p>
          </CardContent>
        </Card>
      </div>

      {/* DAU chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Active Users (last 30 days)</CardTitle>
          <CardDescription>Distinct sign-ins per day</CardDescription>
        </CardHeader>
        <CardContent>
          <svg viewBox={`0 0 ${dauRows.length * 16} 80`} className="w-full" aria-label="DAU chart">
            {dauRows.map((row, i) => {
              const barH = Math.max(2, (row.count / maxCount) * 70);
              return (
                <g key={row.date}>
                  <rect
                    x={i * 16 + 2}
                    y={80 - barH}
                    width={12}
                    height={barH}
                    className="fill-blue-500"
                    rx={2}
                  />
                  <title>
                    {row.date}: {row.count}
                  </title>
                </g>
              );
            })}
          </svg>
          {dauRows.length === 0 && (
            <p className="text-center text-sm text-neutral-500">No data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Cohort heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cohort Retention (8 weeks)</CardTitle>
          <CardDescription>% of cohort active each subsequent week</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="text-xs">
            <caption className="sr-only">Cohort retention table</caption>
            <thead>
              <tr>
                <th className="pb-2 pe-4 text-start font-medium text-neutral-500">Cohort</th>
                {Array.from({ length: 8 }, (_, i) => (
                  <th key={i} className="px-2 pb-2 font-medium text-neutral-500">
                    W{i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(cohortData.cohortTable ?? []).map((row) => (
                <tr key={row.cohortWeek}>
                  <td className="py-1 pe-4 font-mono text-neutral-500">{row.cohortWeek}</td>
                  {row.weeks.map((pct, wi) => (
                    <td key={wi} className="px-2 py-1 text-center">
                      {pct === -1 ? (
                        <span className="text-neutral-300">—</span>
                      ) : (
                        <span
                          className="rounded px-1 py-0.5"
                          style={{
                            backgroundColor: `rgba(59,130,246,${pct / 100})`,
                            color: pct > 50 ? '#fff' : '#374151',
                          }}
                        >
                          {pct}%
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {(cohortData.cohortTable ?? []).length === 0 && (
            <p className="text-center text-sm text-neutral-500">No data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
