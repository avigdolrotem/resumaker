'use client';

import { usePathname, useRouter } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import type { Locale } from '@/i18n/routing';

export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale() as Locale;
  const otherLocale: Locale = currentLocale === 'he' ? 'en' : 'he';
  // ISO codes in Latin script for both, not "English"/"עברית" — a
  // short, same-shape label reads as a deliberate matched pair next to
  // ThemeToggle's icon rather than a stray text link, and doesn't
  // switch scripts depending on which language happens to be active.
  const label = otherLocale === 'he' ? 'HE' : 'EN';
  const fullName = otherLocale === 'he' ? 'עברית' : 'English';

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
      aria-label={`Switch to ${fullName}`}
      // Same shape/hover treatment as ThemeToggle — the two sit
      // side by side everywhere (marketing header, app header, auth
      // layout) and read as one matched "preferences" pair now instead
      // of a plain text link next to an icon button.
      className="hover:bg-accent/60 hover:text-brand-700 dark:hover:text-brand-100 text-foreground dark:text-muted-foreground/50 ease-snappy relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-xs font-semibold transition-all duration-200 active:scale-90"
    >
      {label}
    </button>
  );
}
