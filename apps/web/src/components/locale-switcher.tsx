'use client';

import { usePathname, useRouter } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import type { Locale } from '@/i18n/routing';

export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale() as Locale;
  const otherLocale: Locale = currentLocale === 'he' ? 'en' : 'he';
  const label = otherLocale === 'he' ? 'עברית' : 'English';

  return (
    <button
      type="button"
      onClick={() =>
        router.replace(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pathname as any,
          { locale: otherLocale },
        )
      }
      className="hover:text-brand-600 text-foreground ease-smooth rounded-full px-2 py-1 text-sm font-medium transition-colors duration-200"
    >
      {label}
    </button>
  );
}
