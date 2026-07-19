'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Save, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/lib/auth-client';

/**
 * Profile page — name, default email locale, account stats.
 *
 * Two L2 fixes shipped here:
 *   - All copy now goes through next-intl. Was 100% hardcoded English.
 *   - Locale select initializes from the user's stored preference instead
 *     of hardcoded `'he'`. An English user who saved the form without
 *     touching the dropdown was previously getting silently flipped to
 *     Hebrew emails. We now read the real value via /api/account/profile.
 */
export default function ProfilePage() {
  const t = useTranslations('profile');
  const { data: sessionData, refetch } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [locale, setLocale] = useState<'he' | 'en'>('he');
  const [saving, setSaving] = useState(false);

  // The (app) layout already guarantees a valid session server-side
  // before this page ever renders, so `sessionData` will be populated
  // almost immediately — but Better Auth's client can resolve it
  // before or after React's hydration pass depending on timing, and
  // branching render output on that race caused an intermittent
  // hydration mismatch (server always renders the pre-session state;
  // the client's first paint sometimes already has it). Gating on
  // `mounted` instead of `sessionData` directly forces the first
  // client render to match the server's every time, regardless of
  // how fast the session fetch resolves.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const session = mounted ? sessionData : null;

  // Fetch the persisted profile once so the form reflects the source of
  // truth (DB), not just the cached session. useSession doesn't include
  // the `locale` field by default.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/account/profile');
        if (!res.ok) return;
        const data = await res.json();
        if (data?.user?.locale === 'en' || data?.user?.locale === 'he') {
          setLocale(data.user.locale);
        }
        if (data?.user?.name) {
          setName(data.user.name);
        }
      } catch {
        /* non-fatal — stick with defaults */
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, locale }),
      });
      if (res.ok) {
        toast.success(t('saved'));
        await refetch?.();
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error ?? t('saveFailed'));
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            {t('personalTitle')}
          </CardTitle>
          <CardDescription>{t('personalDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('fullName')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={1}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('emailLabel')}</Label>
              <Input id="email" value={session?.user.email ?? ''} disabled dir="ltr" />
              <p className="text-muted-foreground text-xs">{t('emailHint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locale">{t('languageLabel')}</Label>
              <select
                id="locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value as 'he' | 'en')}
                className="border-input bg-background/60 text-foreground focus-visible:border-brand-400/60 focus-visible:bg-background ease-smooth focus-visible:ring-brand-500/18 flex h-10 w-full rounded-xl border px-3.5 py-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-4"
              >
                <option value="he">עברית (Hebrew)</option>
                <option value="en">English</option>
              </select>
              <p className="text-muted-foreground text-xs">{t('languageHint')}</p>
            </div>

            <Button type="submit" disabled={saving}>
              <Save className="me-2 h-4 w-4" />
              {saving ? t('saving') : t('save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('statsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('emailVerified')}</span>
            <span>
              {session?.user.emailVerified ? (
                <span className="text-emerald-600">✓ {t('emailVerifiedYes')}</span>
              ) : (
                <span className="text-amber-600">{t('emailVerifiedNo')}</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('memberSince')}</span>
            <span dir="ltr">
              {session &&
                new Date(session.user.createdAt).toLocaleDateString(
                  locale === 'he' ? 'he-IL' : 'en-US',
                )}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
