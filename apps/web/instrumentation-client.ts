/**
 * Sentry init for the browser. Next.js 16 picks this file up
 * automatically as the client-side counterpart to `instrumentation.ts`.
 *
 * Without this, client-side uncaught errors (React render errors,
 * fetch failures inside `onClick` handlers, etc.) silently disappear.
 *
 * SENTRY_DSN is intentionally exposed via NEXT_PUBLIC_SENTRY_DSN at
 * build time — Sentry DSNs are designed to be public (they're the
 * tenant id; rate limiting + project quotas live on the Sentry side).
 */

import * as Sentry from '@sentry/nextjs';

const DSN = process.env['NEXT_PUBLIC_SENTRY_DSN'];

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Replay is OFF by default and downsampled on errors. The original
    // `replaysOnErrorSampleRate: 1.0` would record EVERY client error
    // as a full session replay — on a buggy launch day a single bad
    // deploy can blow Sentry quota in hours. 0.1 still catches most
    // user-visible repros while keeping cost predictable.
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

// Required export per Next.js 16 client-instrumentation API
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
