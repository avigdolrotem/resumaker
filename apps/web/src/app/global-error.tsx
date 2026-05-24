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
 * Deliberately dependency-free:
 *  - No next-intl (it's outside the [locale] tree, no provider context)
 *  - No Tailwind class shortcuts (inline styles only) so a CSS load
 *    failure doesn't make THIS page unreadable too
 *  - No Sentry import — instrumentation-client.ts already captures
 *    uncaught client errors before they reach this boundary
 *
 * The styling is hand-tuned inline styles. Mirrors the marketing
 * page's brand palette (#6d28d9 = brand-700) without depending on
 * Tailwind classes resolving.
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
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: '#1c1917',
          // Subtle brand-tinted background — matches the marketing
          // page's animated mesh palette but static (no animation,
          // since this page must work even when JS partially fails).
          background:
            'radial-gradient(ellipse at top left, rgba(167,139,250,0.18), transparent 50%), radial-gradient(ellipse at bottom right, rgba(244,114,182,0.15), transparent 50%), #fafafa',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 540,
            width: '100%',
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(167, 139, 250, 0.25)',
            borderRadius: 20,
            padding: '40px 32px',
            textAlign: 'center',
            boxShadow:
              '0 25px 50px -12px rgba(109, 40, 217, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.5)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Top accent bar — matches the auth card */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: 4,
              background: 'linear-gradient(90deg, #6d28d9, #a855f7, #6d28d9)',
            }}
          />

          <div
            aria-hidden
            style={{
              width: 64,
              height: 64,
              margin: '0 auto 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #fde68a, #f59e0b)',
              boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.4)',
            }}
          >
            <svg
              width={32}
              height={32}
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              margin: '0 0 12px',
              letterSpacing: '-0.02em',
              color: '#0c0a09',
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              color: '#525252',
              margin: '0 0 32px',
              lineHeight: 1.6,
              fontSize: 16,
            }}
          >
            We hit an unexpected error. The issue has been logged and we&apos;ll look into it. Try
            refreshing — if it keeps happening, email{' '}
            <a
              href="mailto:support@resumaker.co.il"
              style={{ color: '#6d28d9', textDecoration: 'underline', fontWeight: 500 }}
            >
              support@resumaker.co.il
            </a>
            .
          </p>

          {error.digest && (
            <p
              style={{
                fontSize: 11,
                color: '#a3a3a3',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                marginBottom: 28,
                letterSpacing: '0.02em',
              }}
            >
              Reference: <span style={{ color: '#737373', userSelect: 'all' }}>{error.digest}</span>
            </p>
          )}

          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                background: 'linear-gradient(135deg, #6d28d9, #5b21b6)',
                color: '#fff',
                border: 'none',
                padding: '12px 28px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow:
                  '0 10px 25px -5px rgba(109, 40, 217, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow =
                  '0 15px 30px -5px rgba(109, 40, 217, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow =
                  '0 10px 25px -5px rgba(109, 40, 217, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
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
                padding: '12px 28px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#a78bfa';
                e.currentTarget.style.background = '#faf5ff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#d4d4d4';
                e.currentTarget.style.background = '#fff';
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
