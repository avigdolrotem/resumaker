'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signUp } from '@/lib/auth-client';

export default function SignUpPage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const { error: signUpError } = await signUp.email({ email, password, name });

    if (signUpError) {
      setError(signUpError.message ?? t('errors.generic'));
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('signUp.title')}</CardTitle>
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
            <p className="text-xs text-neutral-500">{t('signUp.passwordHint')}</p>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t('common.loading') : t('signUp.cta')}
          </Button>

          <p className="text-center text-sm text-neutral-600">
            {t('signUp.haveAccount')}{' '}
            <Link href="/sign-in" className="text-brand-600 font-medium hover:underline">
              {t('signIn.cta')}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
