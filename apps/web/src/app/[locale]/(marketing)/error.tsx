'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Error boundary for the (marketing) segment (homepage, pricing, blog,
 * examples, etc). Without this, an uncaught error here fell through to
 * global-error.tsx, which replaces the entire <html> and is hardcoded
 * to lang="en" — a jarring, non-RTL, unbranded page for Hebrew visitors
 * hitting an error on any public page.
 */
export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.boundary');

  useEffect(() => {
    console.error('[marketing-error]', error);
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
            <div className="bg-muted text-foreground rounded-xl px-3 py-2 font-mono text-xs">
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
