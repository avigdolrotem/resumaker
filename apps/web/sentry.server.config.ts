/**
 * Sentry Node.js init — runs in the server runtime (route handlers,
 * server components, server actions, middleware on Node). Imported by
 * `instrumentation.ts:register()`.
 *
 * The init is gated on SENTRY_DSN — without it, Sentry init is a no-op
 * and no events are sent (safe for environments where you don't want
 * telemetry).
 *
 * PII scrubber matches the one in `lib/observability.ts` so events from
 * both paths get the same treatment.
 */

import * as Sentry from '@sentry/nextjs';

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
  if (depth > 6) return input;
  if (input === null || input === undefined) return input;
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    return input.map((v) => scrubPii(v, depth + 1)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = PII_KEYS.has(k) ? '[REDACTED]' : scrubPii(v, depth + 1);
  }
  return out as T;
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false, // Israeli Privacy Protection Law
    beforeSend(event) {
      if (event.extra) event.extra = scrubPii(event.extra);
      if (event.tags) event.tags = scrubPii(event.tags);
      if (event.contexts) event.contexts = scrubPii(event.contexts);
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
}
