'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OAuthButtons } from '@/components/oauth-buttons';
import { signUp } from '@/lib/auth-client';

export default function SignUpPage() {
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
        /* ignore */
      });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const name = String(form.get('name') ?? '');

    if (password.length < 12) {
      setError(t('errors.passwordTooShort'));
      setLoading(false);
      return;
    }

    try {
      const { error: signUpError } = await signUp.email({ email, password, name });
      if (signUpError) {
        // A soft-deleted account still inside its restore window: the server
        // rejects the re-signup (code ACCOUNT_PENDING_DELETION) and we point
        // the user at sign-in, which auto-restores on correct credentials.
        if (signUpError.code === 'ACCOUNT_PENDING_DELETION') {
          setError(t('errors.accountPendingDeletion'));
        } else {
          setError(signUpError.message ?? t('errors.generic'));
        }
        setLoading(false);
        return;
      }
      try {
        // Unverified accounts have no session (requireEmailVerification=true),
        // so pushing to /dashboard immediately bounces to sign-in — the
        // "jumps to login" bug. Send the user to the verify-pending screen.
        router.push(`/sign-up/verify-pending?email=${encodeURIComponent(email)}`);
      } catch (navErr) {
        setError((navErr as Error).message);
        setLoading(false);
      }
    } catch (err) {
      // Network/5xx safety net — see sign-in for the same pattern.
      setError((err as Error).message || t('errors.generic'));
      setLoading(false);
    }
  }

  return (
    <Card className="border-brand-200/50 dark:border-brand-800/50 shadow-brand-500/10 animate-liquid-pop relative overflow-hidden">
      <div
        aria-hidden
        className="from-brand-500 to-brand-500 absolute inset-x-0 top-0 h-1 bg-gradient-to-r via-purple-500"
      />
      <CardHeader className="pt-8">
        <CardTitle className="text-2xl">{t('signUp.title')}</CardTitle>
        <CardDescription>{t('signUp.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('fields.name')}</Label>
            <Input id="name" name="name" type="text" required autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('fields.email')}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('fields.password')}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={12}
              dir="ltr"
            />
            <p className="text-muted-foreground text-xs">{t('signUp.passwordHint')}</p>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Matches the sign-in CTA style — gradient + glow + shine. */}
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
              {loading ? t('common.loading') : t('signUp.cta')}
            </span>
          </button>
        </form>

        <OAuthButtons showGoogle={providers.google} showGitHub={providers.github} />

        <p className="text-muted-foreground mt-4 text-center text-sm">
          {t('signUp.haveAccount')}{' '}
          <Link
            href="/sign-in"
            className="text-brand-600 dark:text-brand-300 font-medium hover:underline"
          >
            {t('signIn.cta')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
