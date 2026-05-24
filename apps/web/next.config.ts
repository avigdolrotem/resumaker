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
  // Source maps off in production to avoid leaking server-side logic (LLM
  // prompts, security patterns) to client-side DevTools.
  productionBrowserSourceMaps: false,

  // Strict security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            // Production CSP. `unsafe-eval` removed (Next 16 + React 19 don't
            // require it). `unsafe-inline` on script-src remains because Next's
            // hydration script is inlined; nonce-based CSP for that is the
            // post-launch tightening goal.
            //
            // `img-src` narrowed to explicit hosts instead of `https:` wildcard
            // so we don't allow loading from arbitrary trackers if the app is
            // ever embedded in a 3rd-party context.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
              "img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://*.stripe.com https://*.lemonsqueezy.com",
              "connect-src 'self' https://api.anthropic.com https://*.sentry.io",
              // Stripe Checkout uses a hosted iframe + same for LS
              'frame-src https://checkout.stripe.com https://*.lemonsqueezy.com https://js.stripe.com',
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self' https://checkout.stripe.com",
              "object-src 'none'",
              'upgrade-insecure-requests',
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
