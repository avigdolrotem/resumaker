/**
 * Theme-cookie + helpers.
 *
 * Four modes:
 *   - `light`        — default white background, brand purple accents
 *   - `dark-purple`  — deep violet background, brand stays vivid (on-brand dark)
 *   - `dark-gray`    — near-black neutral background, desaturated accents
 *   - `system`       — follow OS prefers-color-scheme (resolves to light or dark-purple)
 *
 * The choice is stored in the `resumaker.theme` cookie so the server can
 * render the correct `<html class="..." data-theme="...">` and avoid a
 * flash-of-unstyled-content on hydration. Client-side, a small inline
 * script (in layout.tsx <head>) resolves `system` against
 * window.matchMedia and updates the class before paint.
 *
 * Tailwind's `dark:` variant fires whenever the html has class="dark".
 * The `data-theme` attribute splits the two dark variants for the
 * handful of styles that need to differ (background HSL, card opacity).
 */

export type Theme = 'light' | 'dark-purple' | 'dark-gray' | 'system';
export const THEMES: Theme[] = ['light', 'dark-purple', 'dark-gray', 'system'];
// Default to `light` (not `system`) so first-time visitors get a
// deterministic, on-brand light rendering — most of our audience uses
// light-mode by default on resume sites, and the dark variant is opt-in
// via the toggle. Returning `system` users still pick it up via the
// theme cookie + the inline init script (which only flips for `system`).
export const DEFAULT_THEME: Theme = 'light';
export const THEME_COOKIE = 'resumaker.theme';

export function isTheme(v: string | undefined | null): v is Theme {
  return v === 'light' || v === 'dark-purple' || v === 'dark-gray' || v === 'system';
}

/**
 * Resolve `system` against an explicit `prefers-color-scheme` value.
 * Used on the server (where we don't know the OS pref → assume dark-purple
 * to avoid a flash for the majority of dark-mode users) and on the client
 * (where we DO know the OS pref via matchMedia).
 */
export function resolveTheme(t: Theme, prefersDark?: boolean): Exclude<Theme, 'system'> {
  if (t !== 'system') return t;
  return prefersDark ? 'dark-purple' : 'light';
}

/**
 * Return the className + data-theme tuple to apply to <html>. Browsers
 * only react to the CLASS for tailwind's dark: variant, but the
 * data-theme lets us split dark-purple vs dark-gray in globals.css.
 */
export function htmlAttrsForTheme(resolved: Exclude<Theme, 'system'>): {
  className: string;
  dataTheme: string;
} {
  if (resolved === 'light') return { className: '', dataTheme: 'light' };
  if (resolved === 'dark-purple') return { className: 'dark', dataTheme: 'dark-purple' };
  return { className: 'dark', dataTheme: 'dark-gray' };
}

/**
 * Inline-script string injected into <head> so the OS preference is
 * applied BEFORE first paint when the user picks `system`. Without
 * this, a system-set dark user would briefly see a white flash on
 * every navigation. Reads the cookie + matchMedia and toggles the
 * class synchronously.
 *
 * `theme` is the cookie value passed from the server. If it's
 * already `light` / `dark-purple` / `dark-gray` we trust the server's
 * SSR choice and do nothing. Only `system` needs the OS check.
 */
export function themeInitScript(theme: Theme): string {
  return `(function(){try{var t=${JSON.stringify(theme)};if(t!=='system')return;var dark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var html=document.documentElement;if(dark){html.classList.add('dark');html.setAttribute('data-theme','dark-purple');}else{html.classList.remove('dark');html.setAttribute('data-theme','light');}}catch(e){}})();`;
}
