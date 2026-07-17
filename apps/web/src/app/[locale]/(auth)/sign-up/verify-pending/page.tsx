'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MailCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';

// Resend is server-rate-limited (/send-verification-email: window 300s, max 3).
// The client cooldown is a UX guard so users don't hammer the button and hit
// that 429 — it does NOT replace the server limit.
const RESEND_COOLDOWN_SECONDS = 60;

type ResendStatus = 'idle' | 'sending' | 'sent' | 'error';

function VerifyPendingInner() {
  const t = useTranslations('auth');
  const params = useSearchParams();
  // Email is carried over from the sign-up form so we can both display it and
  // target the resend. Empty when someone deep-links here directly.
  const email = params.get('email') ?? '';

  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<ResendStatus>('idle');

  // Count the cooldown down one second at a time.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const resendDisabled = !email || cooldown > 0 || status === 'sending';

  async function handleResend() {
    if (resendDisabled) return;
    setStatus('sending');
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: '/sign-in',
      });
      if (error) {
        setStatus('error');
        return;
      }
      setStatus('sent');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      // Network/5xx — surface a retry-able error, keep the button usable.
      setStatus('error');
    }
  }

  return (
    <Card className="border-brand-200/50 dark:border-brand-800/50 shadow-brand-500/10 animate-liquid-pop relative overflow-hidden">
      <div
        aria-hidden
        className="from-brand-500 to-brand-500 absolute inset-x-0 top-0 h-1 bg-gradient-to-r via-purple-500"
      />
      <CardHeader className="items-center pt-8 text-center">
        <span
          aria-hidden
          className="from-brand-500 to-brand-600 mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-lg"
        >
          <MailCheck className="h-7 w-7" />
        </span>
        <CardTitle className="text-2xl">{t('verifyPending.title')}</CardTitle>
        {email ? (
          <CardDescription>
            {t.rich('verifyPending.sentTo', {
              email,
              strong: (chunks) => (
                <strong className="text-foreground font-semibold" dir="ltr">
                  {chunks}
                </strong>
              ),
            })}
          </CardDescription>
        ) : (
          <CardDescription>{t('verifyPending.instruction')}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-center text-sm">
          {t('verifyPending.instruction')}
        </p>

        <div className="bg-muted/40 text-muted-foreground space-y-1.5 rounded-md border p-3 text-xs">
          <p>{t('verifyPending.spam')}</p>
          <p>{t('verifyPending.ttl')}</p>
        </div>

        {/* Status line is announced to screen readers when it changes. */}
        <p
          aria-live="polite"
          className={
            status === 'sent'
              ? 'text-center text-sm font-medium text-green-700 dark:text-green-400'
              : status === 'error'
                ? 'text-center text-sm font-medium text-red-700 dark:text-red-400'
                : 'sr-only'
          }
        >
          {status === 'sent' && t('verifyPending.resent')}
          {status === 'error' && t('verifyPending.resendError')}
        </p>

        <button
          type="button"
          onClick={handleResend}
          disabled={resendDisabled}
          className="border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/40 focus-visible:ring-brand-500 ease-snappy inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border bg-transparent text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'sending' && (
            <span
              aria-hidden
              className="border-brand-400 border-t-brand-700 dark:border-t-brand-300 h-4 w-4 animate-spin rounded-full border-2"
            />
          )}
          {status === 'sending'
            ? t('verifyPending.resending')
            : cooldown > 0
              ? t('verifyPending.resendCooldown', { seconds: cooldown })
              : t('verifyPending.resend')}
        </button>

        <div className="flex flex-col items-center gap-2 pt-1 text-sm">
          <Link
            href="/sign-up"
            className="text-brand-600 dark:text-brand-300 font-medium hover:underline"
          >
            {t('verifyPending.differentEmail')}
          </Link>
          <Link href="/sign-in" className="text-muted-foreground hover:underline">
            {t('verifyPending.backToSignIn')}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyPendingPage() {
  // useSearchParams requires a Suspense boundary during prerender (Next 16).
  return (
    <Suspense fallback={null}>
      <VerifyPendingInner />
    </Suspense>
  );
}
