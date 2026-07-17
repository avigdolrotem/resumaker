import { setRequestLocale } from 'next-intl/server';

/**
 * /[locale]/status — public status page.
 *
 * Server-rendered: hits our own /api/health/ready (already deployed)
 * and renders per-dependency status. Cache for 30s to limit traffic.
 *
 * This is the public-facing version. For the admin operator dashboard
 * (with uptime history, response times, etc), see /admin/health (M6).
 */

interface DepStatus {
  name: string;
  ok: boolean;
  detail?: string;
}

export const revalidate = 30;

async function fetchHealth(): Promise<{ overall: boolean; deps: DepStatus[]; ts: string }> {
  try {
    // Internal call — Next.js server-side fetch
    const base = process.env['APP_URL'] ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/health/ready`, { cache: 'no-store' });
    if (!res.ok) {
      return {
        overall: false,
        deps: [{ name: 'Status endpoint', ok: false, detail: `HTTP ${res.status}` }],
        ts: new Date().toISOString(),
      };
    }
    const data = await res.json();
    const deps: DepStatus[] = Object.entries(data.deps ?? {}).map(([name, info]) => ({
      name,
      ok: Boolean((info as { ok?: boolean }).ok),
      ...((info as { error?: string }).error ? { detail: (info as { error?: string }).error } : {}),
    }));
    return { overall: Boolean(data.ok), deps, ts: data.ts ?? new Date().toISOString() };
  } catch (err) {
    return {
      overall: false,
      deps: [{ name: 'Internal probe', ok: false, detail: (err as Error).message }],
      ts: new Date().toISOString(),
    };
  }
}

export default async function StatusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isHe = locale === 'he';
  const status = await fetchHealth();

  return (
    <main className="relative mx-auto max-w-3xl overflow-hidden px-4 py-12">
      <h1 className="text-3xl font-bold">{isHe ? 'סטטוס מערכת' : 'System status'}</h1>
      <p className="text-muted-foreground mt-2">
        {isHe ? 'מתעדכן כל 30 שניות. בעדכון נכון לתאריך:' : 'Refreshed every 30 seconds. As of:'}{' '}
        <time dir="ltr">{new Date(status.ts).toLocaleString()}</time>
      </p>

      <div
        className={`ease-smooth mt-6 rounded-2xl border p-6 backdrop-blur-md transition-all duration-500 ${
          status.overall
            ? 'border-emerald-200/60 bg-emerald-50/70 dark:border-emerald-800/50 dark:bg-emerald-950/30'
            : 'border-amber-200/60 bg-amber-50/70 dark:border-amber-800/50 dark:bg-amber-950/30'
        }`}
      >
        <p className="text-lg font-semibold">
          {status.overall
            ? isHe
              ? '✓ כל המערכות פעילות'
              : '✓ All systems operational'
            : isHe
              ? '⚠ בעיה זוהתה'
              : '⚠ Issue detected'}
        </p>
      </div>

      <h2 className="mt-8 text-lg font-semibold">{isHe ? 'תלויות' : 'Dependencies'}</h2>
      <ul className="mt-3 space-y-2">
        {status.deps.map((d) => (
          <li
            key={d.name}
            className="glass-subtle ease-smooth flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-500 hover:-translate-y-0.5"
          >
            <div>
              <p className="font-medium">{d.name}</p>
              {d.detail && <p className="text-muted-foreground mt-1 text-xs">{d.detail}</p>}
            </div>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                d.ok
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200'
                  : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-200'
              }`}
            >
              {d.ok ? (isHe ? 'תקין' : 'OK') : isHe ? 'תקלה' : 'Down'}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground mt-8 text-xs">
        {isHe ? 'בעיה מתמשכת? ' : 'Ongoing issue? '}
        <a
          href={`/${locale}/contact`}
          className="text-brand-600 dark:text-brand-300 font-medium hover:underline"
        >
          {isHe ? 'פנה לתמיכה' : 'Contact support'}
        </a>
      </p>
    </main>
  );
}
