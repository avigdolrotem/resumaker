'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

  if (sent) {
    return (
      <Card className="animate-liquid-pop">
        <CardHeader>
          <CardTitle>{t('forgot.sentTitle')}</CardTitle>
          <CardDescription>{t('forgot.sentSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-600">{t('forgot.checkEmail')}</p>
          <div className="mt-6">
            <Link href="/sign-in" className="text-brand-600 text-sm font-medium hover:underline">
              {t('signIn.cta')}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-liquid-pop">
      <CardHeader>
        <CardTitle>{t('forgot.title')}</CardTitle>
        <CardDescription>{t('forgot.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('fields.email')}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" dir="ltr" />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t('common.loading') : t('forgot.cta')}
          </Button>

          <p className="text-center text-sm text-neutral-600">
            <Link href="/sign-in" className="text-brand-600 font-medium hover:underline">
              {t('forgot.backToSignIn')}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
