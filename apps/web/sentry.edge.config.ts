/**
 * Sentry init for the Edge runtime (middleware / proxy.ts).
 *
 * Edge runtime is stricter than Node — no fs, limited APIs. Init is
 * the same shape as the server config but without the PII scrub helper
 * (edge errors rarely carry PII payloads). If a future middleware
 * captures user-shaped data, add the scrubber here too.
 */

import * as Sentry from '@sentry/nextjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
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
