import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Standard Next page extensions only. The blog uses .mdx files but
  // processes them via gray-matter + react-markdown at runtime — not as
  // Next pages — so @next/mdx is not needed and was pulling deadweight
  // into the bundle.
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages export raw .ts source via `main: src/index.ts`.
  // Without transpilePackages Next refuses to compile them through SWC
  // and the container build fails on the first import of a workspace
  // package's transitive deps.
  transpilePackages: [
    '@resumaker/shared',
    '@resumaker/ai-safety',
    '@resumaker/ats-scorer',
    '@resumaker/job-engine',
    '@resumaker/resume-engine',
  ],
  // Source maps off in production to avoid leaking server-side logic (LLM
  // prompts, security patterns) to client-side DevTools.
  productionBrowserSourceMaps: false,

  // Strict security headers.
  //
  // HSTS and `upgrade-insecure-requests` are production-only — both tell
  // the browser "always use HTTPS for this origin from now on," and
  // `next dev` doesn't serve TLS. Sending them unconditionally broke local
  // dev in Safari: WebKit honors HSTS/upgrade-insecure-requests for
  // localhost more strictly than Chromium does, so every subresource
  // (CSS, JS chunks, fonts) got force-upgraded to `https://localhost:3000`
  // and failed with a TLS handshake error against a port that only speaks
  // HTTP — the page loaded (the initial HTML request predates the
  // upgrade), but nothing else did, so it rendered fully unstyled with a
  // dead app shell. Chrome happened to tolerate it, which is why this went
  // unnoticed; it was never a real Safari feature gap. Gating both behind
  // NODE_ENV fixes it for every browser, not just Safari.
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Spectre/cross-window isolation. COEP intentionally omitted
          // because Stripe/LS iframes break under credentialless.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          {
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'usb=()',
              'payment=(self "https://checkout.stripe.com" "https://*.lemonsqueezy.com")',
              'accelerometer=()',
              'gyroscope=()',
              'magnetometer=()',
              'interest-cohort=()',
              'browsing-topics=()',
              'attribution-reporting=()',
            ].join(', '),
          },
          ...(isProd
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]
            : []),
          {
            // Production CSP. `unsafe-eval` removed (Next 16 + React 19 don't
            // require it at runtime). `unsafe-inline` on script-src remains
            // because Next's hydration script is inlined; nonce-based CSP for
            // that is the post-launch tightening goal.
            //
            // Dev-only exception: React's development build still calls
            // eval() itself (for reconstructing component stack traces in
            // warnings/errors) even though production never does — without
            // 'unsafe-eval' here, every dev session logs a permanent "1
            // Issue" console error that has nothing to do with real app
            // code, drowning out actual problems. Scoped to !isProd so
            // production keeps the tighter policy.
            //
            // `img-src` narrowed to explicit hosts instead of `https:` wildcard
            // so we don't allow loading from arbitrary trackers if the app is
            // ever embedded in a 3rd-party context.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
              "img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://*.stripe.com https://*.lemonsqueezy.com",
              // No api.anthropic.com — LLM calls happen server-side via the
              // AI Gateway, never from the browser.
              "connect-src 'self' https://*.sentry.io",
              // Stripe Checkout uses a hosted iframe + same for LS
              'frame-src https://checkout.stripe.com https://*.lemonsqueezy.com https://js.stripe.com',
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self' https://checkout.stripe.com",
              "object-src 'none'",
              ...(isProd ? ['upgrade-insecure-requests'] : []),
            ].join('; '),
          },
        ],
      },
    ];
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Allow user avatars from OAuth providers
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },

  experimental: {
    // Server Actions + RSC are stable in Next 16
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Output as standalone for Docker deployment
  output: 'standalone',
};

// `withSentryConfig` uploads source maps to Sentry on every build so
// prod stack traces are readable instead of looking like minified
// gibberish. The upload step itself is a no-op when SENTRY_AUTH_TOKEN
// isn't set (local + CI without the secret), so this wrapper is safe
// in every environment. See:
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
export default withSentryConfig(withNextIntl(nextConfig), {
  org: 'resumaker-yc',
  project: 'javascript-nextjs',

  // Source map upload only happens when SENTRY_AUTH_TOKEN is provided
  // (typically as a GitHub Actions secret passed to `docker build`).
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Tunnel /api/sentry-tunnel through our own origin so ad-blockers
  // don't drop client error events. Costs an extra Next route but no
  // client-side blocker false positives.
  tunnelRoute: '/api/sentry-tunnel',
  disableLogger: true, // strips Sentry's own console logs from prod bundle
  reactComponentAnnotation: { enabled: true }, // better breadcrumbs
  // Don't fail the build if Sentry upload errors out (e.g. token missing).
  // Stack traces will still work, just won't be deminified server-side.
  errorHandler: (err) => {
    console.warn('[sentry-build] source map upload skipped:', err.message);
  },
});
