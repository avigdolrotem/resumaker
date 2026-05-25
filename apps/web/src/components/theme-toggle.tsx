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

  function applyTheme(next: Theme) {
    setTheme(next);
    setOpen(false);
    // 1y persistence — short enough that the user can change preference
    // forever, long enough that they don't need to re-pick after a few
    // weeks. `SameSite=Lax` so it ships with same-site requests.
    document.cookie = `${THEME_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // Apply immediately — no waiting for next request.
    const html = document.documentElement;
    if (next === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
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
        className="hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/40 dark:hover:text-brand-100 inline-flex h-9 w-9 items-center justify-center rounded-md text-sm text-neutral-700 transition dark:text-neutral-300"
      >
        <CurrentIcon className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="border-border bg-card absolute end-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border shadow-2xl"
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
                onClick={() => applyTheme(o.value)}
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
