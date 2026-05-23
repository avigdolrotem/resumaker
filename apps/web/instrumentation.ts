/**
 * Next.js 16 instrumentation hook.
 *
 * Runs ONCE per process startup, before any request handler. Used here
 * to initialize Sentry for the server (and edge) runtimes so uncaught
 * errors are captured automatically — not just the ones we manually
 * forward via `lib/observability.ts:captureError`.
 *
 * No-op when SENTRY_DSN is unset (Sentry SDK exits silently).
 * Browser-side Sentry init lives in `instrumentation-client.ts`.
 *
 * Docs: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */

export async function register() {
  // Dynamic import keeps Sentry out of the default bundle when DSN is unset
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// onRequestError forwards errors thrown in Server Components / Route
// Handlers to Sentry. Without this, route-level errors that don't go
// through our explicit `captureError` calls are lost.
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(err, request, context);
}
