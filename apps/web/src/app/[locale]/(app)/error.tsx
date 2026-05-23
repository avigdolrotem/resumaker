'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Error boundary for the (app) segment.
 * Replaces the default Next.js error overlay with a branded recovery UI.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app-error]', error);
    // TODO: send to Sentry when DSN configured
  }, [error]);

  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Something went wrong</CardTitle>
          <CardDescription>
            We hit an unexpected error. Try again, or contact us if it keeps happening.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.digest && (
            <div className="rounded-md bg-neutral-100 px-3 py-2 font-mono text-xs text-neutral-700">
              Error ID: {error.digest}
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={reset}>Try again</Button>
            <Button variant="outline" asChild>
              <a href="/">Back home</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
