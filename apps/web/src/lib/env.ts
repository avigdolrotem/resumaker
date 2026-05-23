/**
 * Centralized environment variable validation.
 *
 * Validated once at import-time so misconfiguration fails fast with a clear
 * message instead of producing mysterious 500s on first request.
 *
 * Usage:
 *   import { env } from '@/lib/env';
 *   env.ANTHROPIC_API_KEY  // typed string
 */

import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // App
  APP_URL: z.string().url().default('http://localhost:3000'),
  APP_NAME: z.string().default('Resumaker'),
  DEFAULT_LOCALE: z.enum(['he', 'en']).default('he'),
  SUPPORTED_LOCALES: z.string().default('he,en'),
  CRON_SECRET: z.string().min(32, 'CRON_SECRET must be >=32 chars').optional(),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Redis
  REDIS_URL: z.string().optional(),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be >=32 chars'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),

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

  // LLM
  ANTHROPIC_API_KEY: z.string().regex(/^sk-ant-/, 'Invalid Anthropic API key'),
  DEFAULT_LLM_MODEL: z.string().default('claude-sonnet-4-6'),
  FALLBACK_LLM_MODEL: z.string().default('claude-haiku-4-5'),
  PARSE_LLM_MODEL: z.string().default('claude-haiku-4-5'),
  LLM_MAX_TOKENS: z.coerce.number().int().positive().default(4096),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  LLM_CONCURRENCY_LIMIT: z.coerce.number().int().positive().default(20),

  // Safety
  PROMPT_INJECTION_DETECTION: z.enum(['strict', 'lenient']).default('strict'),
  MAX_INPUT_LENGTH_CHARS: z.coerce.number().int().positive().default(20_000),
  RATE_LIMIT_PER_USER_PER_HOUR: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_PER_IP_PER_HOUR: z.coerce.number().int().positive().default(20),

  // AWS
  AWS_REGION: z.string().default('il-central-1'),
  AWS_S3_BUCKET: z.string().optional(),

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

  // Feature flags: currently no flags are gating anything in the app.
  // Add them here (with `default('false')`) once you wire a flag check
  // in the code so the env contract stays meaningful.
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
