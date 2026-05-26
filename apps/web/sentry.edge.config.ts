/**
 * Sentry init for the Edge runtime (middleware / proxy.ts).
 *
 * Edge runtime is stricter than Node — no fs, limited APIs. Init is
 * the same shape as the server config with the same PII scrub applied
 * so edge errors receive identical treatment to server-side events.
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
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (PII_KEYS.has(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = scrubPii(v, depth + 1);
    }
  }
  return out as T;
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
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
