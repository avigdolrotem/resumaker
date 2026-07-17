'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { THEME_COOKIE, type Theme, isTheme } from '@/lib/theme';

/**
 * Theme toggle — a direct light/dark-purple switch, not a menu.
 *
 * Previously a 4-option dropdown (light / dark-purple / dark-gray /
 * system). Dropped to two themes by product decision (two deliberate
 * choices beat four, and no silent OS-driven switch), and a binary
 * choice doesn't need a menu — a single click that swaps the icon and
 * flips the theme is less friction than open-menu-then-pick.
 *
 * Writes the choice to a cookie + applies the class/data-theme on the
 * <html> element synchronously so the change is instant (no flash, no
 * round-trip). The cookie is read server-side on the next page render
 * so SSR stays correct.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  // Hydrate from the cookie on mount. We DON'T re-apply the DOM here —
  // the server already rendered with the right cookie-based class, so
  // doing it again would cause a layout thrash.
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)resumaker\.theme=([^;]+)/);
    const v = m && m[1] ? decodeURIComponent(m[1]) : null;
    if (isTheme(v)) setTheme(v);
  }, []);

  function toggle() {
    const next: Theme = theme === 'light' ? 'dark-purple' : 'light';

    // `secure` so the cookie is never sent over plaintext HTTP. Omit on
    // dev (localhost is http://) so the cookie still sticks during local
    // development; everywhere else (preview, prod) is https.
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const secure = isSecure ? '; secure' : '';
    document.cookie = `${THEME_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${secure}`;

    const html = document.documentElement;
    if (next === 'light') {
      html.classList.remove('dark');
      html.setAttribute('data-theme', 'light');
    } else {
      html.classList.add('dark');
      html.setAttribute('data-theme', 'dark-purple');
    }

    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      className="hover:bg-accent/60 hover:text-brand-700 dark:hover:text-brand-100 text-foreground dark:text-muted-foreground/50 ease-snappy relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm transition-all duration-200 active:scale-90"
    >
      {/* Crossfade + rotate between the two icons rather than an
          instant swap — matches the site's spring-motion language even
          for a one-off utility control. */}
      <Sun
        className={`ease-snappy absolute h-4 w-4 transition-all duration-300 ${
          theme === 'light' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'
        }`}
      />
      <Moon
        className={`ease-snappy absolute h-4 w-4 transition-all duration-300 ${
          theme === 'dark-purple'
            ? 'rotate-0 scale-100 opacity-100'
            : '-rotate-90 scale-0 opacity-0'
        }`}
      />
    </button>
  );
}
