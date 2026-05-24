'use client';

/**
 * Global error boundary — Next.js renders this when an uncaught error
 * propagates past every other error boundary (including the per-route
 * `error.tsx` files). Without it, Next falls back to its built-in
 * `globalError` component which shows the generic "This page couldn't
 * load. Reload to try again, or go back." — indistinguishable from a
 * real outage (and ironically what the now-fixed hydration crash
 * surfaced as for days).
 *
 * Conventions Next 16 requires for this file:
 *   - MUST be a Client Component (`'use client'` at top)
 *   - MUST render its own <html> and <body> (it replaces the root layout)
 *   - MUST accept `{ error, reset }` props
 *
 * We deliberately keep this dependency-free:
 *  - No next-intl (it's outside the [locale] tree, no provider context)
 *  - No Tailwind class shortcuts (inline styles only) so a CSS load
 *    failure doesn't make THIS page unreadable too
 *  - No Sentry import — instrumentation-client.ts already captures
 *    uncaught client errors before they reach this boundary
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log everything we can extract from the error object. next-intl's
    // wrapper strips the original message (`catch{throw new Error(void 0)}`),
    // so the only forensic info we have is the stack, the digest (React's
    // hashed signature for the original throw), and any preserved `.cause`.
    // eslint-disable-next-line no-console
    console.error('[global-error]', {
      message: error.message,
      name: error.name,
      digest: error.digest,
      cause: (error as Error & { cause?: unknown }).cause,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: '#fafafa',
          color: '#1c1917',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 24 }} aria-hidden>
            ⚠️
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 12px' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#525252', margin: '0 0 24px', lineHeight: 1.5 }}>
            We hit an unexpected error. The issue has been logged and we&apos;ll look into it. Try
            refreshing — if it keeps happening, email{' '}
            <a href="mailto:support@resumaker.co.il" style={{ color: '#6d28d9' }}>
              support@resumaker.co.il
            </a>
            .
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 12,
                color: '#737373',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                marginBottom: 24,
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                background: '#6d28d9',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                background: '#fff',
                color: '#1c1917',
                border: '1px solid #d4d4d4',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
