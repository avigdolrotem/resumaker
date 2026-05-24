import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  /**
   * Supported locales
   * - `he`: Hebrew (RTL, primary, default)
   * - `en`: English (LTR, secondary)
   *
   * Arabic and Russian were stubbed at V7 but never professionally
   * audited and were never in the launch plan. They were removed so we
   * don't ship machine-translated UI as a polished product.
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
