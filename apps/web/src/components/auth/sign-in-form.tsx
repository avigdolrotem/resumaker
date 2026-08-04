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
import { signIn } from '@/lib/auth-client';

/**
 * The sign-in card, extracted from the /sign-in page so the same form
 * can render either as a full page (direct nav / refresh / no-JS
 * fallback — `app/[locale]/(auth)/sign-in/page.tsx` just renders this
 * with no props) or inside AuthModal (opened from elsewhere in the app
 * without leaving the page).
 *
 * `onSwitchToSignUp` / `onSuccess` are only passed by the modal — when
 * absent, "Sign up" is a normal Link and success just navigates, same
 * as the original page-only version always did.
 */
export function SignInForm({
  onSwitchToSignUp,
  onSuccess,
}: {
  onSwitchToSignUp?: () => void;
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
        onSuccess?.();
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
          {/* "Forgot password?" sits AFTER the input, not beside the
              label. In the label row it came before the password field in
              DOM order, so tabbing from email landed on the link rather
              than the field someone is obviously about to fill — an
              interruption on the single most-typed form in the app, and
              worst for exactly the keyboard and screen-reader users least
              able to recover from it. */}
          <div className="space-y-2">
            <Label htmlFor="password">{t('fields.password')}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              dir="ltr"
            />
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-brand-600 text-xs hover:underline">
                {t('signIn.forgotPassword')}
              </Link>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Same GlowButton used for the header/hero CTAs — this is
              the one flagship action on this screen. */}
          <GlowButton
            type="submit"
            size="md"
            disabled={loading}
            loading={loading}
            className="w-full"
          >
            {loading ? t('common.loading') : t('signIn.cta')}
          </GlowButton>
        </form>

        <OAuthButtons showGoogle={providers.google} showGitHub={providers.github} />

        <p className="text-muted-foreground mt-4 text-center text-sm">
          {t('signIn.noAccount')}{' '}
          {onSwitchToSignUp ? (
            <button
              type="button"
              onClick={onSwitchToSignUp}
              className="text-brand-600 dark:text-brand-300 font-medium hover:underline"
            >
              {t('signUp.cta')}
            </button>
          ) : (
            <Link
              href="/sign-up"
              className="text-brand-600 dark:text-brand-300 font-medium hover:underline"
            >
              {t('signUp.cta')}
            </Link>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
