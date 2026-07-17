'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const t = useTranslations('auth');
  const token = sp.get('token');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    router.push('/sign-in');
  }

  return (
    <Card className="animate-liquid-pop">
      <CardHeader>
        <CardTitle>{t('reset.title')}</CardTitle>
        <CardDescription>{t('reset.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        {!token ? (
          <div className="space-y-4">
            <p className="text-sm text-red-700">{t('reset.noToken')}</p>
            <Link
              href="/forgot-password"
              className="text-brand-600 text-sm font-medium hover:underline"
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
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t('common.loading') : t('reset.cta')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
