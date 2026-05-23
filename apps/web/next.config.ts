import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
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

export default withNextIntl(nextConfig);
