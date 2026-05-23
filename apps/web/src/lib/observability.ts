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

/**
 * PII keys to redact from any Sentry payload (`extra`, `tags`, breadcrumbs).
 * Defense-in-depth — `sendDefaultPii: false` already strips Sentry's
 * built-in PII, but `captureException(err, { extra: { email, ... } })`
 * passes our own dicts through unchanged. This scrub catches those.
 */
const PII_KEYS = new Set([
  'email',
  'phone',
  'name',
  'fullName',
  'firstName',
  'lastName',
  'userEmail',
  'username',
  'address',
  'ip',
  'ipAddress',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'authorization',
  'cookie',
  'sessionId',
  'stripeCustomerId',
  'lsCustomerId',
]);

function scrubPii<T>(input: T, depth = 0): T {
  if (depth > 6) return input; // belt-and-suspenders against pathological nesting
  if (input === null || input === undefined) return input;
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    return input.map((v) => scrubPii(v, depth + 1)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (PII_KEYS.has(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = scrubPii(v, depth + 1);
    }
  }
  return out as T;
}

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
      sendDefaultPii: false, // No PII per Israeli Privacy Protection Law
      beforeSend(event) {
        // Scrub PII from user-attached extra/tags/contexts before send.
        // Sentry's own redactor handles the `user` field; this catches
        // our domain-specific keys (stripeCustomerId etc).
        if (event.extra) event.extra = scrubPii(event.extra);
        if (event.tags) event.tags = scrubPii(event.tags);
        if (event.contexts) event.contexts = scrubPii(event.contexts);
        // Wipe request headers + query strings that may contain tokens
        if (event.request) {
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
          }
        }
        return event;
      },
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

/**
 * Minimal structured logger. Use this instead of bare console calls
 * so we can route through Sentry for higher-severity events. Signature
 * is pino-compatible (context first, then message) for future migration.
 */
export const logger = {
  debug(ctx: Record<string, unknown> | string, msg?: string): void {
    if (env.LOG_LEVEL === 'debug' && env.NODE_ENV !== 'test') {
      const [c, m] = typeof ctx === 'string' ? [{}, ctx] : [ctx, msg ?? ''];
      console.debug('[debug]', m, c);
    }
  },
  info(ctx: Record<string, unknown> | string, msg?: string): void {
    if (env.NODE_ENV !== 'test') {
      const [c, m] = typeof ctx === 'string' ? [{}, ctx] : [ctx, msg ?? ''];
      console.log('[info]', m, c);
    }
  },
  warn(ctx: Record<string, unknown> | string, msg?: string): void {
    const [c, m] = typeof ctx === 'string' ? [{}, ctx] : [ctx, msg ?? ''];
    if (env.NODE_ENV !== 'test') console.warn('[warn]', m, c);
    void captureMessage(m, 'warning', c);
  },
  error(ctx: Record<string, unknown> | string, msg?: string): void {
    const [c, m] = typeof ctx === 'string' ? [{}, ctx] : [ctx, msg ?? ''];
    if (env.NODE_ENV !== 'test') console.error('[error]', m, c);
    void captureMessage(m, 'error', c);
  },
};
