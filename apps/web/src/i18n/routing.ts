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
   * Localized pathnames if needed in the future.
   * e.g. /he/קורות-חיים, /en/resume
   */
  pathnames: {
    '/': '/',
    '/resume': {
      he: '/קורות-חיים',
      en: '/resume',
    },
    '/templates': {
      he: '/תבניות',
      en: '/templates',
    },
    '/pricing': {
      he: '/מחירים',
      en: '/pricing',
    },
    '/sign-in': {
      he: '/כניסה',
      en: '/sign-in',
    },
    '/sign-up': {
      he: '/הרשמה',
      en: '/sign-up',
    },
  },

  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

/**
 * Get reading direction for a locale.
 */
export function getDirection(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr';
}
