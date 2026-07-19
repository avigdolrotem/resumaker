/**
 * Per-tier limits and feature flags.
 *
 * Single source of truth for what each tier can do. Used by feature
 * gate helpers and the marketing pricing page. Update here, every
 * gate updates automatically.
 *
 * Pricing in NIS, inclusive of intent:
 *   - Plus: ₪29/mo, ₪290/yr, ₪75 one-time (Job Hunt Pack, 90 days)
 *   - Pro:  ₪79/mo, ₪790/yr, ₪199 one-time (Job Hunt Pack, 90 days)
 *
 * Yearly = ~2 months free vs monthly (industry-standard 17% discount).
 * 3-month "Job Hunt Pack" targets the Israeli market where most job
 * hunts last 2-4 months and users prefer one-time over subscriptions.
 */

export type Tier = 'free' | 'plus' | 'pro';

/** Billing intervals we support. */
export type BillingInterval = 'monthly' | 'yearly' | 'quarterly';

export interface TierLimits {
  /** Hard cap on active (non-deleted) resumes. -1 = unlimited. */
  maxResumes: number;
  /** Hard cap on AI generations per day. -1 = unlimited. */
  generationsPerDay: number;
  /** Hard cap on cover letters per month. -1 = unlimited. 0 = disabled. */
  coverLettersPerMonth: number;
  /** ATS scoring access level. */
  atsScoring: 'none' | 'basic' | 'full' | 'deep';
  /** Can choose between LLM models (Haiku vs Sonnet vs Opus). */
  modelChoice: boolean;
  /** Resume version history retention in days. -1 = unlimited. */
  versionHistoryDays: number;
  /** Total templates accessible (out of 5). */
  totalTemplates: number;
  /** Priority support / faster generation queue. */
  prioritySupport: boolean;
  /** Custom branding removal on free templates. */
  removeBranding: boolean;
  /** LinkedIn profile import. */
  linkedinImport: boolean;
  /** Multi-language resume export (translate HE↔EN automatically). */
  multiLanguageExport: boolean;
  /** Display label for UI. */
  displayName: { he: string; en: string };
  /** Short tagline for pricing card. */
  tagline: { he: string; en: string };
  /** Monthly price in NIS. -1 = free. */
  priceMonthly: number;
  /** Yearly price in NIS. -1 = not offered. */
  priceYearly: number;
  /** One-time "Job Hunt Pack" price in NIS — grants tier for 90 days. -1 = not offered. */
  priceQuarterly: number;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    maxResumes: 2,
    generationsPerDay: 3,
    coverLettersPerMonth: 1,
    atsScoring: 'basic', // overall score + top 3 missing keywords
    modelChoice: false, // locked to Haiku
    versionHistoryDays: 7,
    totalTemplates: 1, // Modern only — Classic + Minimal are Plus and above
    prioritySupport: false,
    removeBranding: false,
    linkedinImport: false,
    multiLanguageExport: false,
    displayName: { he: 'חינם', en: 'Free' },
    tagline: {
      he: 'התחל לבנות ולראות אם זה מתאים לך',
      en: 'Build one polished resume and see if it fits',
    },
    priceMonthly: -1,
    priceYearly: -1,
    priceQuarterly: -1,
  },
  plus: {
    maxResumes: 10,
    generationsPerDay: 20,
    coverLettersPerMonth: 5,
    atsScoring: 'full', // full breakdown + suggestions
    modelChoice: true, // Sonnet
    versionHistoryDays: 90,
    totalTemplates: 3, // Modern + Classic + Minimal — all currently shipped templates
    prioritySupport: false,
    removeBranding: true,
    linkedinImport: true,
    multiLanguageExport: false,
    displayName: { he: 'פלוס', en: 'Plus' },
    tagline: {
      he: 'לכל מי שמחפש עבודה ברצינות',
      en: 'For anyone actively job hunting',
    },
    priceMonthly: 29,
    priceYearly: 290, // 10 months = save ₪58
    priceQuarterly: 75, // 3-month Job Hunt Pack — ~₪25/mo
  },
  pro: {
    maxResumes: -1,
    generationsPerDay: -1,
    coverLettersPerMonth: -1,
    atsScoring: 'deep', // deep + competitor analysis + salary band
    modelChoice: true, // Sonnet + Opus
    versionHistoryDays: -1,
    totalTemplates: 3, // same set as Plus today — more templates in the post-launch roadmap
    prioritySupport: true,
    removeBranding: true,
    linkedinImport: true,
    multiLanguageExport: true,
    displayName: { he: 'פרו', en: 'Pro' },
    tagline: {
      he: 'ליועצי קריירה ולמשתמשים כבדים',
      en: 'For career coaches and power users',
    },
    priceMonthly: 79,
    priceYearly: 790, // 10 months = save ₪158
    priceQuarterly: 199, // 3-month Job Hunt Pack — ~₪66/mo
  },
};

/** Default tier for new users. */
export const DEFAULT_TIER: Tier = 'free';

/** Tiers ordered low-to-high for comparisons. */
export const TIER_ORDER: Tier[] = ['free', 'plus', 'pro'];

/** Returns true if `a` is at or above `b`. */
export function tierAtLeast(a: Tier, b: Tier): boolean {
  return TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b);
}

/**
 * How long a one-time Job Hunt Pack purchase grants tier access.
 * Used by the checkout/webhook flow to set `currentPeriodEnd`.
 */
export const JOB_HUNT_PACK_DURATION_DAYS = 90;

/** Default interval shown selected on the pricing page. */
export const DEFAULT_BILLING_INTERVAL: BillingInterval = 'monthly';
