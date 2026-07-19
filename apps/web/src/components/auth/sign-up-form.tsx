'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OAuthButtons } from '@/components/oauth-buttons';
import { GlowButton } from '@/components/ui-effects/glow-button';
import { signUp } from '@/lib/auth-client';

/** Sign-up counterpart to SignInForm — see its doc comment for why this
 * is split out from the page. */
export function SignUpForm({
  onSwitchToSignIn,
  onSuccess,
}: {
  onSwitchToSignIn?: () => void;
  onSuccess?: () => void;
} = {}) {
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
        onSuccess?.();
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

          {/* Same GlowButton used for the header/hero CTAs. */}
          <GlowButton
            type="submit"
            size="md"
            disabled={loading}
            loading={loading}
            className="w-full"
          >
            {loading ? t('common.loading') : t('signUp.cta')}
          </GlowButton>
        </form>

        <OAuthButtons showGoogle={providers.google} showGitHub={providers.github} />

        <p className="text-muted-foreground mt-4 text-center text-sm">
          {t('signUp.haveAccount')}{' '}
          {onSwitchToSignIn ? (
            <button
              type="button"
              onClick={onSwitchToSignIn}
              className="text-brand-600 dark:text-brand-300 font-medium hover:underline"
            >
              {t('signIn.cta')}
            </button>
          ) : (
            <Link
              href="/sign-in"
              className="text-brand-600 dark:text-brand-300 font-medium hover:underline"
            >
              {t('signIn.cta')}
            </Link>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
