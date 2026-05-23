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

  // Stripe (off at launch)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

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

  // Feature flags
  FEATURE_JOB_HUNTING_BETA: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  FEATURE_MULTI_LLM_CHOICE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  FEATURE_COVER_LETTER: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
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
