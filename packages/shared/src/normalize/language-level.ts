/**
 * Normalizes a language-proficiency string to one of the strict enum
 * values used by `ResumeSchema.languages[].level`.
 *
 * Background: the canonical schema tightened `level` from a free-form
 * `string` to an enum (`native | fluent | professional | conversational |
 * basic`). Legacy resumes — and AI-parsed resumes that mirror the
 * source document — may produce arbitrary values like "B2", "Advanced",
 * "Mother tongue". This helper maps those at the UI boundary so the
 * Zod parse doesn't reject them.
 *
 * Anything unrecognized defaults to `'professional'` — the middle of
 * the scale, the most defensible guess in the absence of better info.
 *
 * Use this on read paths where you don't fully control the input
 * shape (imports, AI outputs, hydrating older saved resumes). For
 * new user input through our own form controls, the value will
 * already be a valid enum and this is a pass-through.
 */

export type LanguageLevel = 'native' | 'fluent' | 'professional' | 'conversational' | 'basic';

const ENUM_VALUES = new Set<LanguageLevel>([
  'native',
  'fluent',
  'professional',
  'conversational',
  'basic',
]);

const MAP: Readonly<Record<string, LanguageLevel>> = {
  // native
  native: 'native',
  mother: 'native',
  'mother tongue': 'native',
  // fluent
  fluent: 'fluent',
  c2: 'fluent',
  // professional
  professional: 'professional',
  advanced: 'professional',
  proficient: 'professional',
  c1: 'professional',
  b2: 'professional',
  // conversational
  conversational: 'conversational',
  intermediate: 'conversational',
  b1: 'conversational',
  // basic
  basic: 'basic',
  beginner: 'basic',
  elementary: 'basic',
  a2: 'basic',
  a1: 'basic',
};

export function normalizeLanguageLevel(raw: string | undefined | null): LanguageLevel {
  if (!raw) return 'professional';
  const key = raw.trim().toLowerCase();
  if (!key) return 'professional';
  if (ENUM_VALUES.has(key as LanguageLevel)) return key as LanguageLevel;
  return MAP[key] ?? 'professional';
}
