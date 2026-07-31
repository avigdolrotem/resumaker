/**
 * Server-side tier accessor + feature gates.
 *
 * `getUserTier(userId)` is the single source of truth — every gate
 * reads from this. The subscriptions table is the source of truth;
 * a missing row means free (defensive default — never block a user
 * because we forgot to insert their row).
 *
 * Feature gates are pure functions of (tier, currentUsage). Keep
 * them deterministic so they can be unit-tested without a DB.
 */

import { eq, sql, gte, and, isNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { TIER_LIMITS, DEFAULT_TIER, type Tier } from './limits';

/**
 * Look up a user's current tier. Returns `'free'` if no subscription
 * row exists (i.e. user hasn't been migrated yet, or row was deleted).
 * Cached for the request — call freely.
 *
 * Admin override: users with `role='admin'` get effective tier `'pro'`
 * regardless of their actual subscription. Admin is an internal flag,
 * not a billed state — we don't write a Pro subscription row, we just
 * gate feature checks. This is the single source of truth for that
 * promotion; every gate that calls getUserTier picks it up for free.
 */
export async function getUserTier(userId: string): Promise<Tier> {
  // Run role lookup + sub lookup in parallel — neither blocks the other
  // and both are tiny indexed reads.
  const [sub, user] = await Promise.all([
    db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.userId, userId),
      columns: {
        tier: true,
        status: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    }),
    db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { role: true },
    }),
  ]);

  if (user?.role === 'admin') return 'pro';

  if (!sub) return DEFAULT_TIER;

  // Past_due / canceled with grace period: still allow access until period end
  if (sub.status === 'canceled' || sub.status === 'past_due') {
    if (sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()) {
      return sub.tier;
    }
    return DEFAULT_TIER;
  }

  // Incomplete subscriptions (Stripe handshake hasn't finished) are free
  if (sub.status === 'incomplete') return DEFAULT_TIER;

  // Non-renewing grant that has run out. The one-time "Job Hunt Pack"
  // (90 days) is written as status='active' + cancelAtPeriodEnd=true +
  // currentPeriodEnd=+90d — and nothing ever moves it off 'active',
  // because there is no LemonSqueezy subscription behind a one-time
  // order and therefore no `subscription_expired` webhook will ever
  // fire for it. Without this check a single ₪75/₪199 purchase granted
  // the tier permanently.
  //
  // Deliberately scoped to cancelAtPeriodEnd rather than "any active
  // sub whose currentPeriodEnd is past": for a healthy *recurring*
  // subscription currentPeriodEnd is the NEXT billing date, so a
  // renewal webhook that arrives late (or is retried) would otherwise
  // downgrade a paying customer mid-cycle. Falsely revoking access
  // someone paid for is a worse failure than the one being fixed, so
  // this only expires grants that are already flagged as not renewing.
  if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd && sub.currentPeriodEnd <= new Date()) {
    return DEFAULT_TIER;
  }

  return sub.tier;
}

/**
 * Ensure a subscription row exists for the user. Called on first
 * tier check or first sign-in. Idempotent (ON CONFLICT DO NOTHING).
 */
export async function ensureSubscription(userId: string): Promise<void> {
  await db
    .insert(schema.subscriptions)
    .values({
      userId,
      tier: DEFAULT_TIER,
      status: 'active',
    })
    .onConflictDoNothing({ target: schema.subscriptions.userId });
}

// ─── FEATURE GATES ──────────────────────────────────────────────────

export interface GateResult {
  allowed: boolean;
  /** i18n key for the upgrade prompt, if blocked. */
  reasonKey?: string;
  /** Lowest tier that would unlock this feature. */
  requiredTier?: Tier;
  /** Current usage / limit, when relevant. */
  current?: number;
  limit?: number;
}

const ALLOW: GateResult = { allowed: true };

function deny(reasonKey: string, requiredTier: Tier, current?: number, limit?: number): GateResult {
  const result: GateResult = { allowed: false, reasonKey, requiredTier };
  if (current !== undefined) result.current = current;
  if (limit !== undefined) result.limit = limit;
  return result;
}

/** Can the user create another resume? */
export function canCreateResume(tier: Tier, currentResumeCount: number): GateResult {
  const limit = TIER_LIMITS[tier].maxResumes;
  if (limit === -1) return ALLOW;
  if (currentResumeCount >= limit) {
    return deny('billing.gate.resume_limit', 'plus', currentResumeCount, limit);
  }
  return ALLOW;
}

/** Can the user generate another resume today? */
export function canGenerate(tier: Tier, generationsToday: number): GateResult {
  const limit = TIER_LIMITS[tier].generationsPerDay;
  if (limit === -1) return ALLOW;
  if (generationsToday >= limit) {
    return deny('billing.gate.generation_limit', 'plus', generationsToday, limit);
  }
  return ALLOW;
}

/** Can the user create another cover letter this month? */
export function canCreateCoverLetter(tier: Tier, coverLettersThisMonth: number): GateResult {
  const limit = TIER_LIMITS[tier].coverLettersPerMonth;
  if (limit === 0) return deny('billing.gate.cover_letter_disabled', 'plus');
  if (limit === -1) return ALLOW;
  if (coverLettersThisMonth >= limit) {
    return deny('billing.gate.cover_letter_limit', 'plus', coverLettersThisMonth, limit);
  }
  return ALLOW;
}

/** Can the user choose a non-default LLM model? */
export function canChooseLLM(tier: Tier): GateResult {
  if (!TIER_LIMITS[tier].modelChoice) {
    return deny('billing.gate.model_choice', 'plus');
  }
  return ALLOW;
}

/**
 * Pure-function variant of getUserTier for callers that already have
 * the role + tier in memory (server components handed a `users` row,
 * tests, etc). Mirrors the admin override.
 */
export function effectiveTier(user: { role?: string | null; tier?: Tier | null }): Tier {
  if (user.role === 'admin') return 'pro';
  return (user.tier ?? DEFAULT_TIER) as Tier;
}

/** Can the user use a specific template? */
export function canUseTemplate(tier: Tier, templateIndex: number): GateResult {
  const limit = TIER_LIMITS[tier].totalTemplates;
  if (templateIndex < limit) return ALLOW;
  return deny('billing.gate.template_locked', 'plus');
}

// ─── USAGE COUNTERS (DB queries used by the gates) ──────────────────

/** Active (non-deleted) resume count for the user. */
export async function getActiveResumeCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(schema.resumes)
    .where(and(eq(schema.resumes.userId, userId), isNull(schema.resumes.deletedAt)));
  return row?.count ?? 0;
}

/**
 * Compute the UTC instant for midnight in the given IANA timezone.
 *
 * Israeli users see "today" reset at 02:00/03:00 UTC depending on DST.
 * If we used `startOfDay.setUTCHours(0,0,0,0)` they'd hit their daily
 * cap during normal evening usage. Anchoring the counter to Asia/Jerusalem
 * midnight matches user intuition.
 */
/**
 * The real UTC offset of `timezone` right now, as "+HH:MM".
 *
 * Both helpers below used to hardcode "+02:00". Israel is UTC+3 (IDT)
 * from roughly late March to late October, so for ~7 months of the year
 * "midnight Jerusalem" was computed an hour late — a Plus user at 00:30
 * IDT was still being counted against the previous day's cap. The
 * `timezone` argument was also effectively ignored, since only the
 * Y/M/D parts respected it while the offset stayed fixed.
 */
function utcOffsetFor(timezone: string, at: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  }).formatToParts(at);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  // longOffset yields e.g. "GMT+03:00"; "GMT" alone means UTC.
  const match = /GMT([+-]\d{2}:\d{2})/.exec(name);
  return match?.[1] ?? '+00:00';
}

function startOfDayInTimezone(timezone: string): Date {
  // Format the current instant as YYYY-MM-DD in the target tz, then
  // parse that date back as midnight in that tz to get a stable UTC.
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return new Date(`${y}-${m}-${d}T00:00:00${utcOffsetFor(timezone, now)}`);
}

function startOfMonthInTimezone(timezone: string): Date {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  return new Date(`${y}-${m}-01T00:00:00${utcOffsetFor(timezone, now)}`);
}

/** Anchor counters to Israel time so users don't get reset at 2-3am local. */
const COUNTER_TIMEZONE = 'Asia/Jerusalem';

/**
 * Successful AI generations created by this user since midnight Israel
 * time. Only `status = 'success'` counts — `recordGeneration()` (in
 * lib/llm.ts) inserts a row for every outcome including `llm_error` and
 * `output_invalid`, which are provider/validation failures the user got
 * nothing for and isn't at fault for. Counting those against the daily
 * cap meant a couple of transient LLM hiccups could exhaust someone's
 * quota without ever having produced a resume. `rejected_input` is
 * excluded too — the hourly rate limit (a separate, tighter check) is
 * this app's actual abuse defense, so the daily cap doesn't need to
 * double as one and can stay purely a "value delivered" meter.
 */
export async function getGenerationsToday(userId: string): Promise<number> {
  const startOfDay = startOfDayInTimezone(COUNTER_TIMEZONE);
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(schema.generations)
    .where(
      and(
        eq(schema.generations.userId, userId),
        eq(schema.generations.status, 'success'),
        gte(schema.generations.createdAt, startOfDay),
      ),
    );
  return row?.count ?? 0;
}

/** Cover letters created by this user since the 1st of this month Israel time. */
export async function getCoverLettersThisMonth(userId: string): Promise<number> {
  const startOfMonth = startOfMonthInTimezone(COUNTER_TIMEZONE);
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(schema.coverLetters)
    .where(
      and(
        eq(schema.coverLetters.userId, userId),
        gte(schema.coverLetters.createdAt, startOfMonth),
        isNull(schema.coverLetters.deletedAt),
      ),
    );
  return row?.count ?? 0;
}
