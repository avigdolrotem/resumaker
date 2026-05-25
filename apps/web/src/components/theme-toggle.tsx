'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, Palette, Check } from 'lucide-react';
import { THEME_COOKIE, type Theme, isTheme } from '@/lib/theme';

/**
 * Theme switcher dropdown — 4 options (light / dark-purple / dark-gray / system).
 *
 * Writes the choice to a cookie + applies the class/data-theme on the
 * <html> element synchronously so the change is instant (no flash, no
 * round-trip). The cookie is read server-side on the next page render
 * so SSR stays correct.
 *
 * Pure client component. No need for a context provider — there's
 * exactly one consumer (this dropdown), and the DOM is the source of
 * truth (`document.documentElement.dataset.theme`).
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [open, setOpen] = useState(false);

  // Hydrate from the cookie on mount. Falling back to 'system' if no
  // cookie yet keeps the menu in a known state on first visit.
  // We DON'T re-apply the DOM here — the server already rendered with
  // the right cookie-based class, and the inline init script handled
  // `system`. Doing it again would cause a layout thrash.
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)resumaker\.theme=([^;]+)/);
    const v = m && m[1] ? decodeURIComponent(m[1]) : null;
    if (isTheme(v)) setTheme(v);
  }, []);

  // Close on outside click + escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onClick(e: MouseEvent) {
      const el = e.target as HTMLElement;
      if (!el.closest('[data-theme-toggle]')) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [open]);

  /**
   * Write the cookie + flip the html class/data-theme in a single
   * synchronous step. Called from the menu-item click handler with
   * the picked Theme. Kept as a plain function (not an effect) so
   * the change happens BEFORE React's commit phase finishes — no
   * flash, no double-render.
   *
   * Earlier version was inlined in the click handler; pulling it out
   * makes it easier to call from system-pref change listener too.
   */
  function writeTheme(next: Theme) {
    document.cookie = `${THEME_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    const html = document.documentElement;
    if (next === 'system') {
      const prefersDark =
        typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.classList.toggle('dark', prefersDark);
      html.setAttribute('data-theme', prefersDark ? 'dark-purple' : 'light');
    } else if (next === 'light') {
      html.classList.remove('dark');
      html.setAttribute('data-theme', 'light');
    } else {
      html.classList.add('dark');
      html.setAttribute('data-theme', next);
    }
  }

  function applyTheme(next: Theme) {
    writeTheme(next);
    setTheme(next);
    setOpen(false);
  }

  const options: Array<{ value: Theme; label: string; Icon: typeof Sun; desc: string }> = [
    { value: 'light', label: 'Light', Icon: Sun, desc: 'White background, brand purple accents' },
    {
      value: 'dark-purple',
      label: 'Dark — Purple',
      Icon: Palette,
      desc: 'Deep violet, on-brand dark',
    },
    {
      value: 'dark-gray',
      label: 'Dark — Gray',
      Icon: Moon,
      desc: 'Near-black, system-like neutral',
    },
    { value: 'system', label: 'System', Icon: Monitor, desc: 'Follow OS preference' },
  ];

  const current = options.find((o) => o.value === theme);
  const CurrentIcon = current?.Icon ?? Monitor;

  return (
    <div className="relative" data-theme-toggle>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change theme"
        aria-expanded={open}
        aria-haspopup="menu"
        className="hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/40 dark:hover:text-brand-100 text-foreground dark:text-muted-foreground/50 inline-flex h-9 w-9 items-center justify-center rounded-md text-sm transition"
      >
        <CurrentIcon className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          // Bumped z-index from 50 to 100 so the dropdown sits above
          // sticky headers and the auth shell's frosted card. Stopping
          // propagation on inner clicks keeps the document-level
          // outside-click handler from interfering with the radio
          // selection (some browsers fire document handlers ahead of
          // React's synthetic event in certain scenarios).
          className="border-border bg-card absolute end-0 top-full z-[100] mt-2 w-64 overflow-hidden rounded-xl border shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-border text-muted-foreground border-b px-3 py-2 text-xs font-semibold uppercase tracking-wider">
            Theme
          </div>
          {options.map((o) => {
            const active = theme === o.value;
            return (
              <button
                key={o.value}
                role="menuitemradio"
                aria-checked={active}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  applyTheme(o.value);
                }}
                className="hover:bg-muted flex w-full items-start gap-3 px-3 py-2.5 text-start text-sm transition"
              >
                <o.Icon className="text-brand-600 dark:text-brand-300 mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-foreground font-medium">{o.label}</div>
                  <div className="text-muted-foreground text-xs">{o.desc}</div>
                </div>
                {active && (
                  <Check className="text-brand-600 dark:text-brand-300 mt-0.5 h-4 w-4 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
