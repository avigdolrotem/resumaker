import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  /**
   * Supported locales
   * - `he`: Hebrew (RTL, primary)
   * - `en`: English (LTR, secondary)
   */
  locales: ['he', 'en'] as const,
  defaultLocale: 'he',

  /**
   * Using English pathnames in both locales for simplicity (easier to share,
   * type, support analytics). Hebrew users see Hebrew content at /he/sign-up.
   */
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

/**
 * Get reading direction for a locale.
 */
export function getDirection(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr';
}
