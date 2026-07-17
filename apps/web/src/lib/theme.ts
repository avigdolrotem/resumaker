/**
 * Theme-cookie + helpers.
 *
 * Two modes:
 *   - `light`        — default white background, brand purple accents
 *   - `dark-purple`  — deep violet background, brand stays vivid (on-brand dark)
 *
 * Previously also had `dark-gray` (near-black neutral) and `system`
 * (follow OS prefers-color-scheme). Both were dropped by product
 * decision — two clear, deliberate choices instead of four, and no
 * silent OS-driven switch a user didn't explicitly pick. If either
 * comes back, `htmlAttrsForTheme`/`themeInitScript`'s git history has
 * the previous system-resolution logic to restore.
 *
 * The choice is stored in the `resumaker.theme` cookie so the server can
 * render the correct `<html class="..." data-theme="...">` and avoid a
 * flash-of-unstyled-content on hydration — no client-side resolution
 * step is needed since (unlike `system`) both themes are already fully
 * resolved values.
 *
 * Tailwind's `dark:` variant fires whenever the html has class="dark".
 * The `data-theme` attribute exists for the handful of styles that key
 * off it directly rather than the `dark:` variant.
 */

export type Theme = 'light' | 'dark-purple';
export const THEMES: Theme[] = ['light', 'dark-purple'];
// First-time visitors get a deterministic, on-brand light rendering —
// most of our audience uses light-mode by default on resume sites, and
// dark is opt-in via the toggle.
export const DEFAULT_THEME: Theme = 'light';
export const THEME_COOKIE = 'resumaker.theme';

export function isTheme(v: string | undefined | null): v is Theme {
  return v === 'light' || v === 'dark-purple';
}

/**
 * Return the className + data-theme tuple to apply to <html>. Browsers
 * only react to the CLASS for tailwind's dark: variant, but data-theme
 * is kept for styles that branch on it directly.
 */
export function htmlAttrsForTheme(theme: Theme): {
  className: string;
  dataTheme: string;
} {
  if (theme === 'light') return { className: '', dataTheme: 'light' };
  return { className: 'dark', dataTheme: 'dark-purple' };
}
