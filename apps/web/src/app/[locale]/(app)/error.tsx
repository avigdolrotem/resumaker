'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Error boundary for the (app) segment.
 *
 * Branded recovery UI in the user's locale. Sentry is already wired via
 * the instrumentation hook (apps/web/instrumentation.ts) so we don't
 * also need a manual `Sentry.captureException` here — but we still log
 * to console so devs see it during local repro.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.boundary');

  useEffect(() => {
    console.error('[app-error]', error);
  }, [error]);

  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.digest && (
            <div className="rounded-md bg-neutral-100 px-3 py-2 font-mono text-xs text-neutral-700">
              {t('errorIdLabel')}: {error.digest}
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={reset}>{t('tryAgain')}</Button>
            <Button variant="outline" asChild>
              <a href="/">{t('backHome')}</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
