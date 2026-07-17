'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';

export default function ResetPasswordPage() {
  const sp = useSearchParams();
  const t = useTranslations('auth');
  const token = sp.get('token');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) {
      setError(t('reset.noToken'));
      return;
    }
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');

    if (newPassword !== confirm) {
      setError(t('reset.mismatch'));
      setLoading(false);
      return;
    }
    if (newPassword.length < 12) {
      setError(t('errors.passwordTooShort'));
      setLoading(false);
      return;
    }

    const { error: resetError } = await authClient.resetPassword({
      newPassword,
      token,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message ?? t('errors.generic'));
      return;
    }
    // Show the confirmation panel instead of silently redirecting — the
    // user had no other feedback that the reset actually worked.
    setSuccess(true);
  }

  return (
    // Same brand-tinted glass card + top accent bar as sign-in/sign-up so
    // the whole auth flow reads as one design instead of two.
    <Card className="border-brand-200/50 dark:border-brand-800/50 shadow-brand-500/10 animate-liquid-pop relative overflow-hidden">
      <div
        aria-hidden
        className="from-brand-500 to-brand-500 absolute inset-x-0 top-0 h-1 bg-gradient-to-r via-purple-500"
      />
      {/* Spring cross-fade between the form and the success confirmation —
          matches the liquid-settle motion used for state changes elsewhere
          (e.g. app/[locale]/(app)/settings). */}
      <AnimatePresence mode="wait" initial={false}>
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          >
            <CardHeader className="pt-8">
              <CardTitle className="text-2xl">{t('reset.successTitle')}</CardTitle>
              <CardDescription>{t('reset.successSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/sign-in"
                className="text-brand-600 dark:text-brand-300 text-sm font-medium hover:underline"
              >
                {t('reset.goToSignIn')}
              </Link>
            </CardContent>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          >
            <CardHeader className="pt-8">
              <CardTitle className="text-2xl">{t('reset.title')}</CardTitle>
              <CardDescription>{t('reset.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              {!token ? (
                <div className="space-y-4">
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200">
                    {t('reset.noToken')}
                  </div>
                  <Link
                    href="/forgot-password"
                    className="text-brand-600 dark:text-brand-300 text-sm font-medium hover:underline"
                  >
                    {t('forgot.cta')}
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">{t('reset.newPassword')}</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      minLength={12}
                      autoComplete="new-password"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">{t('reset.confirmPassword')}</Label>
                    <Input
                      id="confirm"
                      name="confirm"
                      type="password"
                      required
                      minLength={12}
                      autoComplete="new-password"
                      dir="ltr"
                    />
                  </div>

                  {error && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200">
                      {error}
                    </div>
                  )}

                  {/* Matches sign-in/sign-up's CTA style — gradient + glow + shine. */}
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
                      {loading ? t('common.loading') : t('reset.cta')}
                    </span>
                  </button>
                </form>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
