'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { User, Lock, Bell, Monitor, Database, AlertOctagon, ScreenShare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession, signOut } from '@/lib/auth-client';
import { useRouter, Link } from '@/i18n/navigation';
import { Security2FACard } from '@/components/security-2fa-card';
import { LinkedAccountsCard } from '@/components/linked-accounts-card';

type Tab = 'profile' | 'security' | 'sessions' | 'notifications' | 'appearance' | 'data' | 'danger';

const TABS: { id: Tab; key: string; icon: typeof User }[] = [
  { id: 'profile', key: 'profile', icon: User },
  { id: 'security', key: 'security', icon: Lock },
  { id: 'sessions', key: 'sessions', icon: ScreenShare },
  { id: 'notifications', key: 'notifications', icon: Bell },
  { id: 'appearance', key: 'appearance', icon: Monitor },
  { id: 'data', key: 'data', icon: Database },
  { id: 'danger', key: 'danger', icon: AlertOctagon },
];

/**
 * /settings — tabbed settings hub.
 *
 * Lazy-loads per-tab content so the initial render stays fast. Each tab
 * panel is a small component below. Profile and Danger were inline before
 * the M1 refactor; everything else is new.
 */
export default function SettingsPage() {
  const t = useTranslations('settings');
  const tNav = useTranslations('settings.tabs');
  const [tab, setTab] = useState<Tab>('profile');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="space-y-1" aria-label="Settings sections">
          {TABS.map((it) => {
            const Icon = it.icon;
            const active = tab === it.id;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => setTab(it.id)}
                className={[
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition',
                  active
                    ? 'bg-violet-100 font-medium text-violet-800'
                    : 'text-foreground hover:bg-accent',
                ].join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" />
                <span>{tNav.has(it.key) ? tNav(it.key) : it.key}</span>
              </button>
            );
          })}
        </nav>

        <div>
          {tab === 'profile' && <ProfileTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'sessions' && <SessionsTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'data' && <DataTab />}
          {tab === 'danger' && <DangerTab />}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Profile ───────────────────────────────────────────────────

function ProfileTab() {
  const t = useTranslations('settings.profile');
  const { data: session } = useSession();
  if (!session) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t('name')}</Label>
          <Input defaultValue={session.user.name ?? ''} disabled />
        </div>
        <div className="space-y-2">
          <Label>{t('email')}</Label>
          <Input defaultValue={session.user.email} disabled dir="ltr" />
        </div>
        <div className="space-y-2">
          <Label>{t('memberSince')}</Label>
          <Input defaultValue={new Date(session.user.createdAt).toLocaleDateString()} disabled />
        </div>
        <p className="text-sm">
          <Link href="/profile" className="text-violet-700 hover:underline">
            Edit name + language → Profile page
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Security ──────────────────────────────────────────────────

function SecurityTab() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (next.length < 12) {
      toast.error('Password must be at least 12 characters');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed');
        return;
      }
      toast.success('Password changed. Other sessions were signed out.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            You'll be signed out of all other sessions after a successful change.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Current password</Label>
              <Input
                id="current"
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next">New password</Label>
              <Input
                id="next"
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={12}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={12}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Changing…' : 'Change password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Security2FACard />

      <LinkedAccountsCard />

      <Card>
        <CardHeader>
          <CardTitle>Change email</CardTitle>
          <CardDescription>
            We'll send a verification link to the new address. The change happens after you click
            it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailChangeForm />
        </CardContent>
      </Card>
    </div>
  );
}

function EmailChangeForm() {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/account/email-change/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail, currentPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed');
        return;
      }
      toast.success(`Check ${newEmail} for the verification link.`);
      setNewEmail('');
      setPassword('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="newEmail">New email</Label>
        <Input
          id="newEmail"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
          dir="ltr"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="emailPwd">Current password</Label>
        <Input
          id="emailPwd"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" variant="outline" disabled={submitting || !newEmail || !password}>
        {submitting ? 'Sending…' : 'Send verification link'}
      </Button>
    </form>
  );
}

// ─── Tab: Sessions ──────────────────────────────────────────────────

function SessionsTab() {
  interface Sess {
    id: string;
    createdAt: string;
    expiresAt: string;
    userAgent: string | null;
    ipAddress: string | null;
    isCurrent: boolean;
  }
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/account/sessions');
        if (!res.ok) return;
        const data = await res.json();
        setSessions(data.sessions ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function revoke(id: string) {
    try {
      const res = await fetch(`/api/account/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error("Couldn't revoke");
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success('Session revoked');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        <CardDescription>Sign-ins across devices. Revoke any you don't recognize.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No sessions.</p>
        ) : (
          <ul className="divide-border divide-y">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {parseUA(s.userAgent)}
                    {s.isCurrent && (
                      <span className="ms-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Started {new Date(s.createdAt).toLocaleString()} · expires{' '}
                    {new Date(s.expiresAt).toLocaleDateString()}
                  </p>
                  {s.ipAddress && (
                    <p className="text-muted-foreground font-mono text-[10px]" dir="ltr">
                      ip-hash: {s.ipAddress.slice(0, 12)}…
                    </p>
                  )}
                </div>
                {!s.isCurrent && (
                  <Button variant="outline" size="sm" onClick={() => revoke(s.id)}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function parseUA(ua: string | null): string {
  if (!ua) return 'Unknown device';
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/android/i.test(ua)) return 'Android';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/macintosh/i.test(ua)) return 'Mac';
  if (/windows/i.test(ua)) return 'Windows';
  if (/linux/i.test(ua)) return 'Linux';
  return ua.split(' ')[0] ?? 'Unknown';
}

// ─── Tab: Notifications ─────────────────────────────────────────────

function NotificationsTab() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/account/profile');
        if (!res.ok) return;
        const data = await res.json();
        setPrefs(data.user?.notificationPrefs ?? {});
        setMarketing(Boolean(data.user?.marketingOptIn));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/account/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationPrefs: prefs,
          marketingOptIn: marketing,
        }),
      });
      if (!res.ok) {
        toast.error('Save failed');
        return;
      }
      toast.success('Preferences saved');
    } finally {
      setSaving(false);
    }
  }

  const items: Array<[keyof typeof prefs, string]> = [
    ['emailResumeGenerated', 'Email me when a resume finishes generating'],
    ['emailJobDigest', 'Daily digest of new matching jobs (beta)'],
    ['emailApplicationReminders', 'Application reminders ("apply by X")'],
    ['emailProductUpdates', 'Product updates (new features, templates)'],
  ];

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Email notifications</CardTitle>
        <CardDescription>Critical security emails are always sent.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map(([key, label]) => (
          <label key={key} className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={prefs[key] !== false}
              onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
              className="mt-1"
            />
            <span className="text-sm">{label}</span>
          </label>
        ))}
        <hr />
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm">
            <strong>Marketing emails</strong> — newsletter, special offers, beta invites. (Default
            off, opt-in only per GDPR.)
          </span>
        </label>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save preferences'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Appearance ────────────────────────────────────────────────

function AppearanceTab() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [timezone, setTimezone] = useState('Asia/Jerusalem');
  const [dateFormat, setDateFormat] = useState<'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'>(
    'DD/MM/YYYY',
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/account/profile');
        if (!res.ok) return;
        const data = await res.json();
        if (data.user?.theme) setTheme(data.user.theme);
        if (data.user?.timezone) setTimezone(data.user.timezone);
        if (data.user?.dateFormat) setDateFormat(data.user.dateFormat);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/account/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, timezone, dateFormat }),
      });
      if (!res.ok) {
        toast.error('Save failed');
        return;
      }
      // Apply theme immediately by reloading; CSS picks up next render
      document.documentElement.dataset['theme'] = theme;
      toast.success('Saved');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance & locale</CardTitle>
        <CardDescription>Theme, timezone, and date format.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <select
            id="theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value as typeof theme)}
            className="border-input bg-background text-foreground flex h-10 w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="system">Match my device</option>
            <option value="light">Light</option>
            <option value="dark">Dark (coming soon)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tz">Timezone</Label>
          <select
            id="tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="border-input bg-background text-foreground flex h-10 w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="Asia/Jerusalem">Asia/Jerusalem (Israel)</option>
            <option value="Europe/London">Europe/London (UK)</option>
            <option value="America/New_York">America/New York</option>
            <option value="America/Los_Angeles">America/Los Angeles</option>
            <option value="Europe/Berlin">Europe/Berlin</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="df">Date format</Label>
          <select
            id="df"
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value as typeof dateFormat)}
            className="border-input bg-background text-foreground flex h-10 w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2026)</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2026)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (2026-12-31)</option>
          </select>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Data (existing) ───────────────────────────────────────────

function DataTab() {
  const t = useTranslations('settings.yourData');
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) {
        toast.error(t('exportFailed'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resumaker-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('exportSuccess'));
    } catch (err) {
      toast.error(t('exportFailed'), { description: (err as Error).message });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? `${t('export')}…` : t('export')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Danger ────────────────────────────────────────────────────

function DangerTab() {
  const t = useTranslations('settings.danger');
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSignOutAll() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  async function handleDeleteAccount() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('deleted'));
        router.push('/');
        router.refresh();
      } else {
        toast.error(t('deleteFailed'));
      }
    } catch (err) {
      toast.error(t('deleteFailed'), { description: (err as Error).message });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Sign out of all devices</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleSignOutAll}>
            Sign out everywhere
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-red-700">{t('confirmDescription')}</p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? t('deleting') : t('confirmYes')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  {t('cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="destructive" onClick={handleDeleteAccount}>
              {t('deleteAccount')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
