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
  real,
  jsonb,
  uuid,
  varchar,
  index,
  uniqueIndex,
  unique,
  check,
  customType,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

// No built-in drizzle-orm pg-core column type for tsvector as of 0.45.x.
// Maintained by a Postgres trigger (see migration 0020), not a
// GENERATED ALWAYS AS column — drizzle-kit has no concept of trigger DDL
// either way, so there was no generate-vs-hand-write tradeoff to make;
// this just declares the column exists for query-building purposes.
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

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
    /**
     * Per-user feature flags. JSONB so we can add flags without migrations.
     * Currently consumed: `jobHuntBeta` (gates /jobs + /applications routes).
     * Default `{}` so existing users have no flags enabled — admins
     * opt-in users one-at-a-time via /admin/users/[id].
     */
    featureFlags: jsonb('feature_flags')
      .notNull()
      .default(sql`'{}'::jsonb`)
      .$type<{
        jobHuntBeta?: boolean | undefined;
        /** "Don't show again" on the dashboard onboarding checklist's X. Session-only "not now" dismissal is sessionStorage, not this — see dashboard-dismiss.tsx. */
        onboardingChecklistDismissed?: boolean | undefined;
        /** "Remind me later" on the profile-completion nudge — an ISO timestamp; the nudge re-appears once now() passes it. */
        profileNudgeSnoozedUntil?: string | undefined;
        /**
         * Admin-granted (via a reviewed trustedSharerRequests row, or
         * directly in /admin/users/[id]): manual job imports from this
         * user publish immediately (status='open') instead of landing
         * as status='pending' for admin review. role='hr'/'admin' get
         * the same effective trust without needing this flag — see
         * lib/content-trust.ts's isTrustedSharer.
         */
        trustedSharer?: boolean | undefined;
      }>(),
    /** UI theme: 'system' follows OS preference */
    theme: varchar('theme', { length: 8 })
      .notNull()
      .default('system')
      .$type<'light' | 'dark' | 'system'>(),
    /** IANA timezone string, defaults to Israel */
    timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Jerusalem'),
    /** Date format preference for display */
    dateFormat: varchar('date_format', { length: 16 }).notNull().default('DD/MM/YYYY'),
    /** Explicit opt-in to marketing emails (transactional always allowed) */
    marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
    /**
     * Granular per-channel + per-event notification opt-ins. JSONB so we
     * can add new event types without migrations. Defaults to {} which
     * means "all transactional + opted-in marketing" — explicit `false`
     * suppresses that specific channel/event.
     */
    notificationPrefs: jsonb('notification_prefs')
      .notNull()
      .default(sql`'{}'::jsonb`)
      .$type<{
        emailResumeGenerated?: boolean;
        emailJobDigest?: boolean;
        emailApplicationReminders?: boolean;
        emailProductUpdates?: boolean;
        pushAll?: boolean;
      }>(),
    /** Base64 data-URL avatar (<=2MB). Kept inline rather than S3 to avoid an extra bucket dep. */
    avatar: text('avatar'),
    /**
     * User-selected LLM for resume generation. Gateway-format string
     * (e.g. `anthropic/claude-sonnet-4-5@20250929`). NULL = use tier
     * default. Only Plus/Pro tiers can set this; Free is locked to the
     * tier default (see lib/llm/models.ts).
     * Resolved at request time by `resolveModelForUser` — never trust
     * this field without re-checking the tier gate, since users can
     * downgrade after setting a Pro-only model.
     */
    llmModel: text('llm_model'),
    /** Set true by the Better Auth twoFactor plugin once TOTP is enrolled and verified. */
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    emailIdx: index('users_email_idx').on(t.email),
  }),
);

// ─── M1: EMAIL CHANGE FLOW ──────────────────────────────────────────

/**
 * Pending email-change requests. User submits new email → we email a
 * verification link → on click, we swap `users.email` and delete the
 * request. Token is a random URL-safe string; expires after 1h.
 */
export const emailChangeRequests = pgTable(
  'email_change_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    newEmail: varchar('new_email', { length: 320 }).notNull(),
    token: varchar('token', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: index('email_change_token_idx').on(t.token),
    userIdIdx: index('email_change_user_idx').on(t.userId),
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

/**
 * Better Auth `twoFactor` plugin storage. One row per user when 2FA is
 * enabled; deleted on disable. `secret` is the TOTP shared secret;
 * `backupCodes` is a comma-joined hashed list (Better Auth hashes each
 * code with the auth secret before storing).
 *
 * `verified`/`failedVerificationCount`/`lockedUntil` were missing from
 * the original hand-written table (added in a later better-auth
 * release than what this was first written against) — every call to
 * enableTwoFactor 500'd with "The field verified does not exist in
 * the twoFactor Drizzle schema" until these were added. Field
 * names/types/defaults match better-auth's own
 * plugins/two-factor/schema.ts exactly, not guessed.
 */
export const twoFactors = pgTable(
  'two_factors',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    verified: boolean('verified').notNull().default(true),
    failedVerificationCount: integer('failed_verification_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('two_factors_user_idx').on(t.userId),
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
    // Auto-derived from jobTitle/companyName going forward (see
    // lib/resumes/title.ts) — kept as a real column rather than always
    // computed on read because it's what search/PDF-filename/version
    // history already key off, and older rows predating jobTitle/
    // companyName only have this to fall back on.
    title: varchar('title', { length: 255 }).notNull(),
    /**
     * The job this resume was tailored for — nullable because resumes
     * created before this column existed have neither; the UI falls
     * back to `title` for those rather than showing "null — null".
     * Replaces the old free-text `title` as a resume's primary identity
     * (a person has ONE profile now — see `profiles` below — so distinct
     * resumes are distinguished by which job they target, not by name).
     */
    jobTitle: varchar('job_title', { length: 200 }),
    companyName: varchar('company_name', { length: 200 }),
    locale: varchar('locale', { length: 8 }).notNull(),
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

// ─── CAREER PROFILE ─────────────────────────────────────────────────

/**
 * One canonical career profile per user — contact/summary/experience/
 * education/projects/skills/certifications/awards/languages. Replaces
 * the old per-resume "basic mode" profile form: instead of re-entering
 * (or drifting copies of) the same personal data on every resume, users
 * fill this in once — via the onboarding wizard or an import — and every
 * generated resume tailors this same source data to a specific job
 * description. `content` shape is `ProfileContentSchema` from
 * @resumaker/shared (== ResumeSchema minus `metadata`).
 *
 * This directly replaces the stopgap in
 * app/api/account/profile/route.ts that used to fake a "profile" by
 * reading the user's most-recently-updated resume's content.
 */
export const profiles = pgTable('profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: jsonb('content').notNull(),
  /** Preferred language for generated resumes; independent of users.locale (UI language). */
  resumeLocale: varchar('resume_locale', { length: 8 }).notNull().default('auto'),
  /** Null until the first-run wizard is finished (or explicitly skipped). */
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

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
    // UNIQUE rather than plain index: the version-bump logic in
    // /api/resumes/[id] PATCH does SELECT MAX(versionNumber)+1 → INSERT.
    // Without a unique constraint, two concurrent PATCHes can both pick
    // the same versionNumber. The constraint turns the race into a
    // retry-able conflict instead of silent duplicate rows.
    resumeVersionUnique: unique('resume_versions_resume_version_unique').on(
      t.resumeId,
      t.versionNumber,
    ),
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

// ─── M5: HR COMPANIES + TEAMS ────────────────────────────────────────

/**
 * Company profiles created by HR users. Each company has a slug for
 * the public landing page and an owner (the creating HR user).
 */
export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull().unique(),
    logoUrl: text('logo_url'),
    description: text('description'),
    websiteUrl: text('website_url'),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /**
     * True when the owner's account-email domain matches websiteUrl's
     * hostname (see lib/company-verification.ts) — recomputed on create
     * and on any websiteUrl update, not user-settable directly. A cheap,
     * standard signal (same trust model as Slack Connect / most B2B
     * onboarding): doesn't prove identity, but does stop the trivial case
     * of claiming "Google" while signed in with a personal Gmail.
     */
    verified: boolean('verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: index('companies_slug_idx').on(t.slug),
    ownerIdx: index('companies_owner_idx').on(t.ownerUserId),
  }),
);

/**
 * Team members of a company. Roles: owner | recruiter | viewer.
 * UNIQUE (companyId, userId) enforced at DB level.
 */
export const companyMembers = pgTable(
  'company_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).notNull().default('recruiter'),
    invitedBy: text('invited_by').references(() => users.id, { onDelete: 'set null' }),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyUserUnique: unique('company_members_company_user_unique').on(t.companyId, t.userId),
    companyIdx: index('company_members_company_idx').on(t.companyId),
    userIdx: index('company_members_user_idx').on(t.userId),
  }),
);

/**
 * Pending company invitations sent to an email. On accept, a
 * company_members row is created and this row is deleted.
 */
export const companyInvites = pgTable(
  'company_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 320 }),
    token: varchar('token', { length: 64 }).notNull().unique(),
    role: varchar('role', { length: 16 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: index('company_invites_token_idx').on(t.token),
    companyIdx: index('company_invites_company_idx').on(t.companyId),
  }),
);

// ─── JOB HUNT (L5 BETA) ─────────────────────────────────────────────

/**
 * Scraped + manually-imported job postings. One row per unique posting.
 * Source-of-truth for the job content (title, description, url).
 *
 * Deduped by `(source, externalId)` for scraper rows; `urlNormalized`
 * gets a unique index so manual imports of the same URL twice don't
 * create dupes.
 *
 * Per-user state (favorite, fit-score, application tracking) lives in
 * the joined `userJobs` and `applications` tables. Jobs are shared
 * across users.
 */
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalId: text('external_id'),
    source: varchar('source', { length: 32 }).notNull(),
    company: varchar('company', { length: 200 }).notNull(),
    companySlug: varchar('company_slug', { length: 200 }),
    title: varchar('title', { length: 300 }).notNull(),
    location: varchar('location', { length: 200 }),
    description: text('description').notNull(),
    url: text('url').notNull(),
    urlNormalized: text('url_normalized').notNull(),
    remote: boolean('remote').notNull().default(false),
    seniority: varchar('seniority', { length: 50 }),
    /** HR-posted jobs: the HR user who owns this row (null otherwise) */
    hrUserId: text('hr_user_id').references(() => users.id, { onDelete: 'set null' }),
    /**
     * Manual imports (source='manual'): who pasted/imported it. Deliberately
     * separate from hrUserId, not a reuse — recommendations.ts's HR ranking
     * boost keys off hrUserId being non-null, and a manually-imported job
     * (no claim of representing the company) must never pick that up.
     * Exists for moderation (attribute a bad import to an account) — not
     * currently surfaced on the card itself, only source='manual' is.
     */
    submittedByUserId: text('submitted_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** Company that posted this job (null for scraped jobs) */
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    scrapedAt: timestamp('scraped_at', { withTimezone: true }).notNull().defaultNow(),
    rawData: jsonb('raw_data'),
    /**
     * open: currently live at the source. closed: confirmed gone (explicit
     * signal, or missCount crossed the source's threshold — see the
     * scrape-jobs cron), OR an admin-rejected pending import. unknown: a
     * source that gives no closure signal at all (aggregators) hasn't been
     * seen in a while. pending: a manual import from a non-trusted user
     * (see lib/content-trust.ts) awaiting admin review at
     * /admin/moderation — excluded from listJobs()'s default query for
     * free, same as closed/unknown, since it only ever filters *for*
     * 'open'. Never delete a job row on closure/rejection —
     * applications.jobId and userJobs.jobId both cascade, so a delete
     * here would silently erase a user's application history.
     */
    status: varchar('status', { length: 16 }).notNull().default('open'),
    /** Bumped every time a scrape confirms this job is still listed at its source. */
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    /** Consecutive scrapes where a full-board source didn't return this job. Reset to 0 on any sighting. */
    missCount: integer('miss_count').notNull().default(0),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    /**
     * Cross-source dedup: when the same real-world job is found at more than
     * one source (e.g. a company's own Greenhouse board AND a Comeet
     * listing), the non-canonical row(s) point here instead of being
     * deleted — list queries filter `canonicalJobId IS NULL`, but
     * favorites/applications on a duplicate row keep working untouched.
     */
    canonicalJobId: uuid('canonical_job_id').references((): AnyPgColumn => jobs.id, {
      onDelete: 'set null',
    }),
    /** Taasuka occupation-category tag (or equivalent from other sources) — lets the default feed filter by occupation without re-crawling. */
    occupationCode: varchar('occupation_code', { length: 64 }),
    /**
     * title || ' ' || description, tokenized 'simple' (no Hebrew stemmer
     * in Postgres core — 'simple' plus the GIN index below still gives
     * real ranked full-text search over Hebrew tokens, just without
     * stemming). Kept current by a trigger, not application code — every
     * INSERT/UPDATE of title or description recomputes it regardless of
     * which code path wrote the row. Replaces ILIKE '%q%' substring
     * search, which was always going to be a full table scan and stopped
     * being viable the moment Taasuka's ~16,700 rows landed.
     */
    searchVector: tsvector('search_vector'),
  },
  (t) => ({
    // UNIQUE so the cron's onConflictDoNothing({target: urlNormalized})
    // actually has a constraint to conflict on. Previously a plain index
    // meant every duplicate threw, fell into the inner catch, and was
    // miscounted as "deduped" — masking real failures from new scrapers.
    urlNormUnique: unique('jobs_url_norm_unique').on(t.urlNormalized),
    // Partial: externalId is null for some manual imports, and two nulls
    // aren't equal in a Postgres unique index anyway, but WHERE makes the
    // intent explicit. This is the constraint the table's own top comment
    // already promised ("Deduped by (source, externalId) for scraper
    // rows") but never actually had — every source's upsert should target
    // this, not urlNormalized, so re-scraping the same job updates it in
    // place instead of relying on URL stability across scrapes.
    sourceExternalIdUnique: uniqueIndex('jobs_source_external_id_unique')
      .on(t.source, t.externalId)
      .where(sql`${t.externalId} IS NOT NULL`),
    sourceCompanyIdx: index('jobs_source_company_idx').on(t.source, t.companySlug),
    scrapedAtIdx: index('jobs_scraped_at_idx').on(t.scrapedAt.desc()),
    hrUserIdx: index('jobs_hr_user_idx').on(t.hrUserId),
    statusIdx: index('jobs_status_idx').on(t.status),
    canonicalJobIdx: index('jobs_canonical_job_idx').on(t.canonicalJobId),
    searchVectorIdx: index('jobs_search_vector_idx').using('gin', t.searchVector),
    canonicalNotSelfCheck: check(
      'jobs_canonical_not_self_check',
      sql`${t.canonicalJobId} IS NULL OR ${t.canonicalJobId} != ${t.id}`,
    ),
    statusCheck: check(
      'jobs_status_check',
      sql`${t.status} IN ('open', 'closed', 'unknown', 'pending')`,
    ),
  }),
);

/**
 * A user's request to become a trusted sharer (see lib/content-trust.ts)
 * — free-text justification, reviewed by an admin at /admin/moderation.
 * One row per request; a denied user can submit a new one later (no
 * unique constraint forcing one-per-user-ever), but the API layer only
 * allows one *pending* request outstanding at a time.
 */
export const trustedSharerRequests = pgTable(
  'trusted_sharer_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    note: text('note').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    userIdx: index('trusted_sharer_requests_user_idx').on(t.userId),
    statusIdx: index('trusted_sharer_requests_status_idx').on(t.status),
    // The API's "one pending request at a time" rule was a SELECT
    // followed by an INSERT with nothing in between — five concurrent
    // POSTs reproducibly created three pending rows. The rule has to
    // live here to actually hold; the route now catches the unique
    // violation and returns the same 409 it used to guess at.
    onePendingPerUser: uniqueIndex('trusted_sharer_requests_one_pending_per_user')
      .on(t.userId)
      .where(sql`${t.status} = 'pending'`),
    statusCheck: check(
      'trusted_sharer_requests_status_check',
      sql`${t.status} IN ('pending', 'approved', 'denied')`,
    ),
  }),
);

/**
 * Per-user state on a job (favorite + fit-score). A row is upserted
 * when the user first interacts with the job. Without a row, the job
 * is "unseen" by that user.
 */
export const userJobs = pgTable(
  'user_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    isFavorite: boolean('is_favorite').notNull().default(false),
    fitScore: integer('fit_score'),
    fitRationale: text('fit_rationale'),
    fitStrengths: jsonb('fit_strengths').$type<string[]>(),
    fitGaps: jsonb('fit_gaps').$type<string[]>(),
    /** When fitScore was last computed — lets a reader decide it's fresh enough to reuse instead of re-scoring. */
    fitScoredAt: timestamp('fit_scored_at', { withTimezone: true }),
    /** Set when this row exists because the dashboard recommendation engine surfaced it (vs. the user favoriting/viewing it directly). */
    recommendedAt: timestamp('recommended_at', { withTimezone: true }),
    recommendScore: real('recommend_score'),
    /** User dismissed this recommendation — excluded from future recommendation runs, but the row (and any favorite/application) stays intact. */
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // UNIQUE: one row per (user, job). The comment says "A row is
    // upserted when the user first interacts" — without unique, a
    // concurrent favorite-toggle creates a second row and the upsert
    // pattern silently drifts to a SELECT-and-pick-first.
    userJobUnique: unique('user_jobs_user_job_unique').on(t.userId, t.jobId),
  }),
);

/**
 * Application tracker. One row per (user, job) the user is tracking.
 * Status pipeline: interested → applied → recruiter_screen → tech_interview
 * → onsite → offer / rejected / ghosted. `appliedAt` set when status
 * crosses into 'applied' or beyond.
 *
 * `notifyRecruiter` is the explicit GDPR-consent checkbox: if true and
 * the job is HR-posted, the HR user gets to see this applicant in their
 * applicants list. Defaults false (privacy-by-default).
 */
export const applications = pgTable(
  'applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    resumeId: uuid('resume_id').references(() => resumes.id, { onDelete: 'set null' }),
    coverLetterId: uuid('cover_letter_id').references(() => coverLetters.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 32 }).notNull().default('interested'),
    contactName: varchar('contact_name', { length: 200 }),
    contactEmail: varchar('contact_email', { length: 320 }),
    notes: text('notes'),
    nextActionAt: timestamp('next_action_at', { withTimezone: true }),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    /** Explicit opt-in for HR to see this applicant. Default false. */
    notifyRecruiter: boolean('notify_recruiter').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // UNIQUE: one application per (user, job). Without this, a user
    // can accidentally double-click "Apply" and create two pipeline
    // rows for the same job, then have ambiguous state.
    userJobUnique: unique('applications_user_job_unique').on(t.userId, t.jobId),
    userUpdatedIdx: index('applications_user_updated_idx').on(t.userId, t.updatedAt.desc()),
    jobIdx: index('applications_job_idx').on(t.jobId),
    statusIdx: index('applications_status_idx').on(t.status),
  }),
);

/**
 * One row per scraper invocation. Gives the scrape-jobs cron a resumable
 * cursor (a paged source like Taasuka can process a bounded page-window
 * per cron tick and pick up where it left off next time, instead of
 * needing one invocation to finish a ~1,670-page crawl) and turns "is the
 * pipeline actually working" from a log-diving question into a queryable
 * one.
 */
export const scrapeRuns = pgTable(
  'scrape_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: varchar('source', { length: 32 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** Resume point for a paged/incremental source — shape is source-specific (e.g. Taasuka: { page }). */
    cursor: jsonb('cursor'),
    stats: jsonb('stats'),
    ok: boolean('ok'),
  },
  (t) => ({
    sourceStartedIdx: index('scrape_runs_source_started_idx').on(t.source, t.startedAt.desc()),
  }),
);

// ─── M9: NOTIFICATIONS + SUPPORT ────────────────────────────────────

/** In-app notifications shown in the header bell dropdown. */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 48 }).notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    readAt: timestamp('read_at', { withTimezone: true }),
    /**
     * When this notification was included in a web-push send. The push
     * cron selected on `readAt IS NULL` alone, with no record of what
     * it had already pushed — so an unread notification was re-pushed
     * on every run, nagging daily until the user happened to open it.
     * Set once; the cron skips anything non-null.
     */
    pushedAt: timestamp('pushed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userUnreadIdx: index('notifications_user_unread_idx').on(t.userId, t.readAt),
    userCreatedIdx: index('notifications_user_created_idx').on(t.userId, t.createdAt.desc()),
    // Drives the push cron's "unread and not yet pushed" scan.
    pendingPushIdx: index('notifications_pending_push_idx')
      .on(t.createdAt)
      .where(sql`${t.readAt} IS NULL AND ${t.pushedAt} IS NULL`),
  }),
);

/** Support contact form submissions. */
export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    email: varchar('email', { length: 320 }).notNull(),
    subject: varchar('subject', { length: 200 }).notNull(),
    body: text('body').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('open'),
    repliedAt: timestamp('replied_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusCreatedIdx: index('support_tickets_status_created_idx').on(t.status, t.createdAt.desc()),
  }),
);

// ─── M6: ADMIN OPERATIONS ────────────────────────────────────────────

/** Promotional coupon codes. */
export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 40 }).notNull().unique(),
    discountPercent: integer('discount_percent').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    usageLimit: integer('usage_limit'),
    usageCount: integer('usage_count').notNull().default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => ({
    codeIdx: index('coupons_code_idx').on(t.code),
    discountCheck: check('coupons_discount_check', sql`${t.discountPercent} BETWEEN 1 AND 100`),
  }),
);

/** Records of which user redeemed which coupon. */
export const couponRedemptions = pgTable(
  'coupon_redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    couponId: uuid('coupon_id')
      .notNull()
      .references(() => coupons.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueCouponUser: unique('coupon_redemptions_coupon_user_unique').on(t.couponId, t.userId),
    couponIdx: index('coupon_redemptions_coupon_idx').on(t.couponId),
    userIdx: index('coupon_redemptions_user_idx').on(t.userId),
  }),
);

/** Admin-sent broadcast email records. */
export const broadcastEmails = pgTable(
  'broadcast_emails',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subject: varchar('subject', { length: 200 }).notNull(),
    body: text('body').notNull(),
    locale: varchar('locale', { length: 8 }).notNull().default('he'),
    sentBy: text('sent_by').references(() => users.id, { onDelete: 'set null' }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    recipientCount: integer('recipient_count'),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('broadcast_emails_status_idx').on(t.status),
    createdAtIdx: index('broadcast_emails_created_at_idx').on(t.createdAt.desc()),
  }),
);

/** Admin impersonation session audit trail. */
export const impersonationSessions = pgTable(
  'impersonation_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: text('admin_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetUserId: text('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    reason: text('reason'),
  },
  (t) => ({
    adminIdx: index('impersonation_admin_idx').on(t.adminUserId),
    targetIdx: index('impersonation_target_idx').on(t.targetUserId),
  }),
);

/** Singleton maintenance-mode state (id always = 1). */
export const maintenanceMode = pgTable(
  'maintenance_mode',
  {
    id: integer('id').primaryKey().default(1),
    enabled: boolean('enabled').notNull().default(false),
    message: text('message'),
    scheduledStart: timestamp('scheduled_start', { withTimezone: true }),
    scheduledEnd: timestamp('scheduled_end', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => ({
    idCheck: check('maintenance_mode_singleton', sql`${t.id} = 1`),
  }),
);

// ─── M8: PWA PUSH SUBSCRIPTIONS ─────────────────────────────────────

/**
 * Browser Web Push subscriptions. One row per (userId, endpoint) pair.
 * Endpoint is unique globally — browsers issue one per SW registration.
 */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('push_subscriptions_user_idx').on(t.userId),
  }),
);

// ─── M8: REFERRAL PROGRAM ────────────────────────────────────────────

/**
 * One referral code per user. Auto-created on first /referral visit.
 * `usageCount` is incremented each time someone signs up with this code.
 */
export const referralCodes = pgTable(
  'referral_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 20 }).notNull().unique(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    usageCount: integer('usage_count').notNull().default(0),
    maxUses: integer('max_uses'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: index('referral_codes_code_idx').on(t.code),
    ownerIdx: index('referral_codes_owner_idx').on(t.ownerId),
  }),
);

/**
 * One row per referred user. UNIQUE (referredId) ensures a user can
 * only be referred once. Status pipeline: pending → qualified → rewarded.
 */
export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referrerId: text('referrer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    referredId: text('referred_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    status: varchar('status', { length: 16 })
      .notNull()
      .default('pending')
      .$type<'pending' | 'qualified' | 'rewarded'>(),
    qualifiedAt: timestamp('qualified_at', { withTimezone: true }),
    rewardClaimedAt: timestamp('reward_claimed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    referrerIdx: index('referrals_referrer_idx').on(t.referrerId),
    referredIdx: index('referrals_referred_idx').on(t.referredId),
  }),
);

// ─── V2: SAVED SEARCHES (job-hunt alerts) ───────────────────────────

/**
 * Saved job-search queries that the user wants email alerts for.
 * Query is opaque JSONB matching the shape /api/jobs accepts as query
 * params (q, company, source, remote). The daily digest cron evaluates
 * each saved search, finds new matching jobs since lastNotifiedAt, and
 * emails the user a summary.
 */
export const savedSearches = pgTable(
  'saved_searches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    query: jsonb('query').notNull().$type<{
      q?: string;
      company?: string;
      source?: string;
      remote?: boolean;
    }>(),
    alertFrequency: varchar('alert_frequency', { length: 16 })
      .notNull()
      .default('daily')
      .$type<'daily' | 'weekly' | 'off'>(),
    lastNotifiedAt: timestamp('last_notified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('saved_searches_user_idx').on(t.userId),
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
  profiles,
  atsScores,
  auditLog,
  coverLetters,
  subscriptions,
  stripeWebhookEvents,
  lsWebhookEvents,
  companies,
  companyMembers,
  companyInvites,
  jobs,
  userJobs,
  trustedSharerRequests,
  scrapeRuns,
  savedSearches,
  applications,
  emailChangeRequests,
  twoFactors,
  notifications,
  supportTickets,
  coupons,
  couponRedemptions,
  broadcastEmails,
  impersonationSessions,
  maintenanceMode,
  pushSubscriptions,
  referralCodes,
  referrals,
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
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type TrustedSharerRequest = typeof trustedSharerRequests.$inferSelect;
export type UserJob = typeof userJobs.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
export type CouponRedemption = typeof couponRedemptions.$inferSelect;
export type BroadcastEmail = typeof broadcastEmails.$inferSelect;
export type NewBroadcastEmail = typeof broadcastEmails.$inferInsert;
export type ImpersonationSession = typeof impersonationSessions.$inferSelect;
export type MaintenanceMode = typeof maintenanceMode.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type CompanyMember = typeof companyMembers.$inferSelect;
export type NewCompanyMember = typeof companyMembers.$inferInsert;
export type CompanyInvite = typeof companyInvites.$inferSelect;
export type NewCompanyInvite = typeof companyInvites.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type ReferralCode = typeof referralCodes.$inferSelect;
export type NewReferralCode = typeof referralCodes.$inferInsert;
export type Referral = typeof referrals.$inferSelect;
export type NewReferral = typeof referrals.$inferInsert;
