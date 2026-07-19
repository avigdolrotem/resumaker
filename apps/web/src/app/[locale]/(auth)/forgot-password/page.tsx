'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GlowButton } from '@/components/ui-effects/glow-button';
import { authClient } from '@/lib/auth-client';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');

    await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
    });

    // Always show "sent" message — never reveal whether the email exists
    // (account enumeration prevention)
    setLoading(false);
    setSent(true);
  }

  return (
    // Same brand-tinted glass card + top accent bar as sign-in/sign-up so
    // the whole auth flow reads as one design instead of two.
    <Card className="border-brand-200/50 dark:border-brand-800/50 shadow-brand-500/10 animate-liquid-pop relative overflow-hidden">
      <div
        aria-hidden
        className="from-brand-500 to-brand-500 absolute inset-x-0 top-0 h-1 bg-gradient-to-r via-purple-500"
      />
      {/* Spring cross-fade between the request form and the "check your
          inbox" confirmation — matches the liquid-settle motion used for
          state changes elsewhere (e.g. app/[locale]/(app)/settings). */}
      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          >
            <CardHeader className="pt-8">
              <CardTitle className="text-2xl">{t('forgot.sentTitle')}</CardTitle>
              <CardDescription>{t('forgot.sentSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">{t('forgot.checkEmail')}</p>
              <div className="mt-6">
                <Link
                  href="/sign-in"
                  className="text-brand-600 dark:text-brand-300 text-sm font-medium hover:underline"
                >
                  {t('signIn.cta')}
                </Link>
              </div>
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
              <CardTitle className="text-2xl">{t('forgot.title')}</CardTitle>
              <CardDescription>{t('forgot.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('fields.email')}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    dir="ltr"
                  />
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
                  {loading ? t('common.loading') : t('forgot.cta')}
                </GlowButton>

                <p className="text-muted-foreground text-center text-sm">
                  <Link
                    href="/sign-in"
                    className="text-brand-600 dark:text-brand-300 font-medium hover:underline"
                  >
                    {t('forgot.backToSignIn')}
                  </Link>
                </p>
              </form>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
