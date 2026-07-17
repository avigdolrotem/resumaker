'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OAuthButtons } from '@/components/oauth-buttons';
import { signIn } from '@/lib/auth-client';

export default function SignInPage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<{ google: boolean; github: boolean }>({
    google: false,
    github: false,
  });

  useEffect(() => {
    fetch('/api/auth/providers')
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => {
        /* ignore — buttons just won't show */
      });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    try {
      const { error: signInError } = await signIn.email({ email, password });
      if (signInError) {
        // Map account-state codes to localized copy. ACCOUNT_SUSPENDED/DELETED
        // come from session.create.before; a within-window soft-deleted account
        // is silently restored on correct credentials (no error here at all).
        const byCode: Record<string, string> = {
          ACCOUNT_SUSPENDED: t('errors.accountSuspended'),
          ACCOUNT_DELETED: t('errors.accountDeleted'),
        };
        setError(
          (signInError.code && byCode[signInError.code]) ??
            signInError.message ??
            t('errors.invalidCredentials'),
        );
        setLoading(false);
        return;
      }
      // Navigate but keep loading true so the button stays disabled
      // through the page transition. The unmount cleans it up; if
      // navigation fails (router rejects), we clear here too.
      try {
        router.push('/dashboard');
      } catch (navErr) {
        setError((navErr as Error).message);
        setLoading(false);
      }
    } catch (err) {
      // Better Auth client can throw on network failures (e.g. 5xx
      // responses) — without this catch the loading spinner stuck
      // forever. Surface the real error to the user instead.
      setError((err as Error).message || t('errors.invalidCredentials'));
      setLoading(false);
    }
  }

  return (
    // Base Card is already a glass surface (see components/ui/card.tsx)
    // sitting on top of the auth layout's animated liquid background —
    // this just adds the entrance pop + brand-tinted border/glow on top.
    <Card className="border-brand-200/50 dark:border-brand-800/50 shadow-brand-500/10 animate-liquid-pop relative overflow-hidden">
      {/* Top accent bar — gradient gives the card a "header" without
          extra padding */}
      <div
        aria-hidden
        className="from-brand-500 to-brand-500 absolute inset-x-0 top-0 h-1 bg-gradient-to-r via-purple-500"
      />
      <CardHeader className="pt-8">
        <CardTitle className="text-2xl">{t('signIn.title')}</CardTitle>
        <CardDescription>{t('signIn.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('fields.email')}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" dir="ltr" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('fields.password')}</Label>
              <Link href="/forgot-password" className="text-brand-600 text-xs hover:underline">
                {t('signIn.forgotPassword')}
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              dir="ltr"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Primary CTA with the same glow ring as the marketing hero
              CTA — keeps the visual language consistent across auth +
              marketing. Spinner replaces text while loading. */}
          <button
            type="submit"
            disabled={loading}
            className="ease-snappy group relative inline-flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-full text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              aria-hidden
              className="from-brand-500 to-brand-500 absolute -inset-0.5 rounded-full bg-gradient-to-r via-purple-500 opacity-75 blur-md transition group-hover:opacity-100 group-disabled:opacity-30"
            />
            <span
              aria-hidden
              className="from-brand-600 to-brand-800 absolute inset-0 rounded-full bg-gradient-to-br"
            />
            <span
              aria-hidden
              className="ease-snappy absolute inset-0 -translate-x-full rounded-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
            <span className="relative z-10 inline-flex items-center gap-2">
              {loading && (
                <span
                  aria-hidden
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
              )}
              {loading ? t('common.loading') : t('signIn.cta')}
            </span>
          </button>
        </form>

        <OAuthButtons showGoogle={providers.google} showGitHub={providers.github} />

        <p className="text-muted-foreground mt-4 text-center text-sm">
          {t('signIn.noAccount')}{' '}
          <Link
            href="/sign-up"
            className="text-brand-600 dark:text-brand-300 font-medium hover:underline"
          >
            {t('signUp.cta')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
