/**
 * Observability wrapper.
 *
 * Sentry if SENTRY_DSN configured, no-op otherwise. Lets us instrument
 * code without forcing every dev to set up Sentry locally.
 */

import { env } from '@/lib/env';

type SentryModule = typeof import('@sentry/nextjs');

let sentry: SentryModule | null = null;
let initAttempted = false;

async function getSentry(): Promise<SentryModule | null> {
  if (!env.SENTRY_DSN) return null;
  if (sentry) return sentry;
  if (initAttempted) return null;
  initAttempted = true;
  try {
    sentry = await import('@sentry/nextjs');
    sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
      tracesSampleRate: 0.1,
      sendDefaultPii: false, // No PII per privacy law
    });
    return sentry;
  } catch (err) {
    console.warn('[observability] Sentry init failed', err);
    return null;
  }
}

export async function captureError(err: unknown, context?: Record<string, unknown>): Promise<void> {
  const s = await getSentry();
  if (s) {
    s.captureException(err, context ? { extra: context } : undefined);
  } else if (env.NODE_ENV !== 'test') {
    console.error('[error]', err, context ?? '');
  }
}

export async function captureMessage(
  msg: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>,
): Promise<void> {
  const s = await getSentry();
  if (s) {
    s.captureMessage(msg, context ? { level, extra: context } : { level });
  } else if (env.NODE_ENV !== 'test') {
    const fn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    fn(`[${level}]`, msg, context ?? '');
  }
}
