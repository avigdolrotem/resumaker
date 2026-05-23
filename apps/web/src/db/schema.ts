/**
 * Database schema for Resumaker.
 *
 * Tables:
 *  - users, accounts, sessions, verifications  (Better Auth)
 *  - resumes, generations, ats_scores          (app-specific)
 *  - audit_log                                 (cross-cutting)
 *
 * See docs/AUTH.md for auth schema reasoning.
 */

import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
  varchar,
  index,
} from 'drizzle-orm/pg-core';

// ─── BETTER AUTH TABLES ─────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: varchar('email', { length: 320 }).notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    name: varchar('name', { length: 255 }),
    image: text('image'),
    locale: varchar('locale', { length: 8 }).notNull().default('he'),
    role: varchar('role', { length: 32 }).notNull().default('user'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    emailIdx: index('users_email_idx').on(t.email),
  }),
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: varchar('provider_id', { length: 64 }).notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('accounts_user_id_idx').on(t.userId),
    providerIdx: index('accounts_provider_idx').on(t.providerId, t.accountId),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('sessions_user_id_idx').on(t.userId),
    tokenIdx: index('sessions_token_idx').on(t.token),
    expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
  }),
);

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    identifierIdx: index('verifications_identifier_idx').on(t.identifier),
  }),
);

// ─── APP TABLES ─────────────────────────────────────────────────────

export const resumes = pgTable(
  'resumes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    locale: varchar('locale', { length: 8 }).notNull(),
    industry: varchar('industry', { length: 32 }),
    templateId: varchar('template_id', { length: 50 }).notNull(),
    content: jsonb('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    userIdIdx: index('resumes_user_id_idx').on(t.userId),
    // Hot path: dashboard query filters on (userId, deletedAt IS NULL)
    // ordered by updatedAt. Partial index avoids scanning soft-deleted rows.
    userActiveUpdatedIdx: index('resumes_user_active_updated_idx')
      .on(t.userId, t.updatedAt.desc())
      .where(sql`${t.deletedAt} IS NULL`),
  }),
);

export const generations = pgTable(
  'generations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    resumeId: uuid('resume_id').references(() => resumes.id, { onDelete: 'set null' }),
    model: varchar('model', { length: 64 }).notNull(),
    inputJdHash: varchar('input_jd_hash', { length: 64 }).notNull(),
    inputLengthChars: integer('input_length_chars').notNull(),
    outputLengthChars: integer('output_length_chars'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    durationMs: integer('duration_ms'),
    safetyDetections: jsonb('safety_detections'),
    // Status: 'success' | 'rejected_input' | 'output_invalid' | 'llm_error'
    status: varchar('status', { length: 32 }).notNull(),
    error: text('error'),
    detectedLocale: varchar('detected_locale', { length: 8 }),
    industry: varchar('industry', { length: 32 }),
    inputLength: integer('input_length'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('generations_user_id_idx').on(t.userId),
    createdAtIdx: index('generations_created_at_idx').on(t.createdAt),
    // For admin usage stats: ORDER BY user, day
    userCreatedIdx: index('generations_user_created_idx').on(t.userId, t.createdAt.desc()),
    // For "list this resume's generation history"
    resumeIdIdx: index('generations_resume_id_idx').on(t.resumeId),
  }),
);

export const atsScores = pgTable(
  'ats_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resumeId: uuid('resume_id')
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    overall: integer('overall').notNull(),
    matchedKeywords: jsonb('matched_keywords').notNull(),
    missingKeywords: jsonb('missing_keywords').notNull(),
    suggestions: jsonb('suggestions').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    resumeIdIdx: index('ats_scores_resume_id_idx').on(t.resumeId),
  }),
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id'),
    event: varchar('event', { length: 64 }).notNull(),
    ipHash: varchar('ip_hash', { length: 64 }),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('audit_log_user_id_idx').on(t.userId),
    eventIdx: index('audit_log_event_idx').on(t.event),
    createdAtIdx: index('audit_log_created_at_idx').on(t.createdAt),
  }),
);

// ─── RESUME VERSIONS ────────────────────────────────────────────────

/**
 * Append-only version log for resumes. New row inserted on every PATCH
 * to /api/resumes/[id]. Lets users restore or compare past versions.
 */
export const resumeVersions = pgTable(
  'resume_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resumeId: uuid('resume_id')
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    content: jsonb('content').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    label: varchar('label', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    resumeIdx: index('resume_versions_resume_idx').on(t.resumeId, t.versionNumber),
  }),
);

// ─── COVER LETTERS ──────────────────────────────────────────────────

export const coverLetters = pgTable(
  'cover_letters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    jobDescription: text('job_description'),
    companyName: varchar('company_name', { length: 200 }),
    recipientName: varchar('recipient_name', { length: 200 }),
    tone: varchar('tone', { length: 32 }).notNull().default('formal'),
    locale: varchar('locale', { length: 8 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    userActiveIdx: index('cover_letters_user_active_idx')
      .on(t.userId, t.updatedAt)
      .where(sql`${t.deletedAt} IS NULL`),
  }),
);

// ─── BILLING / SUBSCRIPTIONS ────────────────────────────────────────

/**
 * Per-user subscription record. One row per user.
 *
 * `tier` is the source of truth for feature gates.
 * `provider` indicates which payment system owns this row:
 *   - 'manual'       — admin grant (no external billing)
 *   - 'stripe'       — Stripe Checkout/Billing
 *   - 'lemonsqueezy' — LemonSqueezy (Merchant of Record, no Israeli biz number needed)
 *
 * Provider-specific id fields are nullable so manual grants don't need them
 * and so we can switch providers without dropping data.
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    tier: varchar('tier', { length: 16 })
      .notNull()
      .default('free')
      .$type<'free' | 'plus' | 'pro'>(),
    status: varchar('status', { length: 32 })
      .notNull()
      .default('active')
      .$type<'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing'>(),
    // Which payment provider owns this subscription (defaults to 'manual'
    // so existing free-tier rows don't break).
    provider: varchar('provider', { length: 16 })
      .notNull()
      .default('manual')
      .$type<'manual' | 'stripe' | 'lemonsqueezy'>(),
    // Stripe-specific
    stripeCustomerId: varchar('stripe_customer_id', { length: 64 }),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 64 }),
    stripePriceId: varchar('stripe_price_id', { length: 64 }),
    // LemonSqueezy-specific
    lsCustomerId: varchar('ls_customer_id', { length: 64 }),
    lsSubscriptionId: varchar('ls_subscription_id', { length: 64 }),
    lsVariantId: varchar('ls_variant_id', { length: 64 }),
    /** LS exposes a per-subscription portal URL — cache it for quick redirects */
    lsCustomerPortalUrl: text('ls_customer_portal_url'),
    // Common
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    grantedBy: text('granted_by'), // admin user_id when manually granted
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    stripeCustomerIdx: index('subscriptions_stripe_customer_idx').on(t.stripeCustomerId),
    lsCustomerIdx: index('subscriptions_ls_customer_idx').on(t.lsCustomerId),
    tierIdx: index('subscriptions_tier_idx').on(t.tier),
    providerIdx: index('subscriptions_provider_idx').on(t.provider),
  }),
);

/**
 * Idempotency log for Stripe webhook events. The webhook handler
 * checks for the event id before processing; duplicates are ignored.
 */
export const stripeWebhookEvents = pgTable(
  'stripe_webhook_events',
  {
    id: text('id').primaryKey(), // Stripe event id (evt_xxx)
    type: varchar('type', { length: 64 }).notNull(),
    payload: jsonb('payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
    success: boolean('success').notNull().default(true),
    error: text('error'),
  },
  (t) => ({
    typeIdx: index('stripe_events_type_idx').on(t.type),
    processedIdx: index('stripe_events_processed_idx').on(t.processedAt),
  }),
);

/**
 * Idempotency log for LemonSqueezy webhook events. LS doesn't provide
 * an event id in the payload (only header X-Event-Name), so we store a
 * UUID generated from the body hash + timestamp to dedupe replays.
 */
export const lsWebhookEvents = pgTable(
  'ls_webhook_events',
  {
    /** SHA-256 of (raw body + signature) — naturally idempotent */
    id: text('id').primaryKey(),
    eventName: varchar('event_name', { length: 64 }).notNull(),
    payload: jsonb('payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
    success: boolean('success').notNull().default(true),
    error: text('error'),
  },
  (t) => ({
    eventNameIdx: index('ls_events_name_idx').on(t.eventName),
    processedIdx: index('ls_events_processed_idx').on(t.processedAt),
  }),
);

// ─── EXPORTS ────────────────────────────────────────────────────────

export const schema = {
  users,
  accounts,
  sessions,
  verifications,
  resumes,
  resumeVersions,
  generations,
  atsScores,
  auditLog,
  coverLetters,
  subscriptions,
  stripeWebhookEvents,
  lsWebhookEvents,
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Resume = typeof resumes.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type ATSScore = typeof atsScores.$inferSelect;
export type CoverLetter = typeof coverLetters.$inferSelect;
export type ResumeVersion = typeof resumeVersions.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
