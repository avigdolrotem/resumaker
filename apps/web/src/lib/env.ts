/**
 * Centralized environment variable validation.
 *
 * Validated once at import-time so misconfiguration fails fast with a clear
 * message instead of producing mysterious 500s on first request.
 *
 * Usage:
 *   import { env } from '@/lib/env';
 *   env.AI_GATEWAY_API_KEY  // typed string | undefined
 */

import { z } from 'zod';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // App
    APP_URL: z.string().url().default('http://localhost:3000'),
    // Client-side baseURL for Better Auth (auth-client.ts). Same value
    // as APP_URL in normal deployments; broken out as NEXT_PUBLIC_* so
    // it ends up in the client bundle. Validated here so a typo at
    // build time crashes fast instead of producing an empty baseURL.
    NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
    APP_NAME: z.string().default('Resumaker'),
    DEFAULT_LOCALE: z.enum(['he', 'en']).default('he'),
    SUPPORTED_LOCALES: z.string().default('he,en'),
    CRON_SECRET: z.string().min(32, 'CRON_SECRET must be >=32 chars').optional(),

    // Database
    // DATABASE_URL is optional — only used for local psql tooling (drizzle-kit
    // migrations, direct psql). The app runtime exclusively uses the Cloud SQL
    // Connector path below.
    DATABASE_URL: z.string().optional(),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

    // GCP Cloud SQL — Cloud SQL Connector is the only DB path.
    GCP_CLOUD_SQL_INSTANCE: z.string().min(1), // "project:region:instance"
    GCP_CLOUD_SQL_IAM_USER: z.string().min(1),
    GCP_CLOUD_SQL_DATABASE: z.string().optional().default('resumaker'),
    // IP type for the Cloud SQL Connector. PRIVATE (default) is correct for
    // GKE pods connecting over VPC peering. Set to PUBLIC only for local dev
    // connecting through the Cloud SQL Auth Proxy.
    GCP_CLOUD_SQL_IP_TYPE: z.enum(['PUBLIC', 'PRIVATE']).default('PRIVATE'),

    // Redis
    REDIS_URL: z.string().optional(),

    // Better Auth
    BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be >=32 chars'),
    BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
    // Optional second trusted origin (e.g. apex when BETTER_AUTH_URL is www,
    // or www when BETTER_AUTH_URL is apex). Better Auth refuses requests
    // from any other origin, so both must be listed if both serve traffic.
    // Set this in production OR ensure your edge redirects www↔apex before
    // requests reach Next.js.
    BETTER_AUTH_URL_ALT: z.string().url().optional(),

    // Privacy: HMAC secret for hashing IPs in audit_log. Rotate yearly.
    // Falls back to BETTER_AUTH_SECRET if unset — fine for dev, but
    // production should set a distinct value (so audit_log can be backed
    // up separately from session storage without cross-correlation risk).
    IP_HASH_SALT: z.string().min(32, 'IP_HASH_SALT must be >=32 chars').optional(),

    // OAuth (optional)
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    // LLM — model strings use AI Gateway format `provider/model`.
    // All call-sites route through the Vercel AI Gateway; no direct
    // provider keys are read by the app.
    AI_GATEWAY_API_KEY: z.string().min(1).optional(),
    DEFAULT_LLM_MODEL: z
      .string()
      .regex(/^[a-z]+\/[a-z0-9.\-]+$/, 'Must be provider/model format')
      .default('anthropic/claude-sonnet-4-6'),
    FALLBACK_LLM_MODEL: z
      .string()
      .regex(/^[a-z]+\/[a-z0-9.\-]+$/, 'Must be provider/model format')
      .default('anthropic/claude-haiku-4-5'),
    PARSE_LLM_MODEL: z
      .string()
      .regex(/^[a-z]+\/[a-z0-9.\-]+$/, 'Must be provider/model format')
      .default('anthropic/claude-haiku-4-5'),
    LLM_MAX_TOKENS: z.coerce.number().int().positive().default(4096),
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    LLM_CONCURRENCY_LIMIT: z.coerce.number().int().positive().default(20),

    // Safety
    PROMPT_INJECTION_DETECTION: z.enum(['strict', 'lenient']).default('strict'),
    MAX_INPUT_LENGTH_CHARS: z.coerce.number().int().positive().default(20_000),
    RATE_LIMIT_PER_USER_PER_HOUR: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_PER_IP_PER_HOUR: z.coerce.number().int().positive().default(20),

    // File storage (GCS — Workload Identity provides creds at runtime)
    GCS_BUCKET: z.string().optional(),

    // Payment provider selection.
    //   'none'         — no payments (free tier only). Pricing page shows waitlist CTA.
    //   'stripe'       — Stripe Checkout + webhooks (needs US LLC via Stripe Atlas, or Osek Murshe + Stripe Israel)
    //   'lemonsqueezy' — LemonSqueezy Merchant of Record (no Israeli biz number required, recommended for v1)
    PAYMENT_PROVIDER: z.enum(['none', 'stripe', 'lemonsqueezy']).default('none'),

    // Stripe — only consulted when PAYMENT_PROVIDER='stripe'
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    // Stripe Price IDs — one per tier × interval. `_quarterly` is the
    // 3-month one-time "Job Hunt Pack" (Stripe `mode: 'payment'`).
    STRIPE_PRICE_PLUS_MONTHLY: z.string().optional(),
    STRIPE_PRICE_PLUS_YEARLY: z.string().optional(),
    STRIPE_PRICE_PLUS_QUARTERLY: z.string().optional(),
    STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
    STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
    STRIPE_PRICE_PRO_QUARTERLY: z.string().optional(),

    // LemonSqueezy — only consulted when PAYMENT_PROVIDER='lemonsqueezy'
    LEMONSQUEEZY_API_KEY: z.string().optional(),
    LEMONSQUEEZY_STORE_ID: z.string().optional(),
    LEMONSQUEEZY_WEBHOOK_SECRET: z.string().optional(),
    // LS variant IDs — `_quarterly` is the one-time Job Hunt Pack product
    LEMONSQUEEZY_VARIANT_PLUS_MONTHLY: z.string().optional(),
    LEMONSQUEEZY_VARIANT_PLUS_YEARLY: z.string().optional(),
    LEMONSQUEEZY_VARIANT_PLUS_QUARTERLY: z.string().optional(),
    LEMONSQUEEZY_VARIANT_PRO_MONTHLY: z.string().optional(),
    LEMONSQUEEZY_VARIANT_PRO_YEARLY: z.string().optional(),
    LEMONSQUEEZY_VARIANT_PRO_QUARTERLY: z.string().optional(),

    // Email (Resend)
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().email().default('noreply@resumaker.co.il'),

    // Observability
    SENTRY_DSN: z.string().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),

    // URL fetching for JD parser
    FIRECRAWL_API_KEY: z.string().optional(),
    PLAYWRIGHT_FALLBACK: z
      .string()
      .transform((v) => v === 'true')
      .default('true'),

    // Web Push (VAPID) — optional. Required for push notification cron.
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().email().optional(),

    // Feature flags: currently no flags are gating anything in the app.
    // Add them here (with `default('false')`) once you wire a flag check
    // in the code so the env contract stays meaningful.
  })
  // Production-only sanity checks. Defaults that are fine for `pnpm dev`
  // (localhost URLs, missing CRON_SECRET) silently brick the app if they
  // leak into a GKE deploy. Fail fast at import-time instead.
  .refine((e) => e.NODE_ENV !== 'production' || !e.APP_URL.startsWith('http://localhost'), {
    message: 'APP_URL must be set to the production URL (not localhost) when NODE_ENV=production',
  })
  .refine(
    (e) => e.NODE_ENV !== 'production' || !e.NEXT_PUBLIC_APP_URL.startsWith('http://localhost'),
    {
      message:
        'NEXT_PUBLIC_APP_URL must be set to the production URL (not localhost) when NODE_ENV=production',
    },
  )
  .refine((e) => e.NODE_ENV !== 'production' || !e.BETTER_AUTH_URL.startsWith('http://localhost'), {
    message:
      'BETTER_AUTH_URL must be set to the production URL (not localhost) when NODE_ENV=production — auth will silently break otherwise',
  })
  .refine((e) => e.NODE_ENV !== 'production' || Boolean(e.CRON_SECRET), {
    message: 'CRON_SECRET is required in production so GKE CronJobs can authenticate',
  })
  .refine((e) => e.NODE_ENV !== 'production' || Boolean(e.AI_GATEWAY_API_KEY), {
    message: 'AI_GATEWAY_API_KEY is required in production',
    path: ['AI_GATEWAY_API_KEY'],
  });

function parseEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`❌ Environment validation failed:\n${issues}\n`);
  }
  return result.data;
}

export const env = parseEnv();
export type Env = z.infer<typeof EnvSchema>;
