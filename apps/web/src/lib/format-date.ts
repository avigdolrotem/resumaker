/**
 * Locale-aware date formatting for user-facing surfaces.
 *
 * `new Date(x).toLocaleDateString()` with no locale argument resolves
 * against the *runtime's* locale — which in a Server Component is the
 * container's (typically en-US), not the locale the user is browsing
 * in. Hebrew users were seeing `7/31/2026` instead of `31.7.2026` on
 * every page that formatted a date this way.
 *
 * Admin pages are deliberately English-only and don't need this; these
 * helpers are for anything a normal user sees.
 */

type AppLocale = 'he' | 'en';

const LOCALE_TAG: Record<AppLocale, string> = {
  he: 'he-IL',
  en: 'en-US',
};

function toLocale(locale: string | undefined): AppLocale {
  return locale === 'he' ? 'he' : 'en';
}

/** Date only, e.g. `31.7.2026` (he) / `7/31/2026` (en). */
export function formatDate(
  value: Date | string | number,
  locale: string | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(LOCALE_TAG[toLocale(locale)], options);
}

/** Date + time, for "last active"-style values. */
export function formatDateTime(
  value: Date | string | number,
  locale: string | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(LOCALE_TAG[toLocale(locale)], options);
}
