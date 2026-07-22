/**
 * Shared font registration for resume PDF templates.
 *
 * Why centralized: @react-pdf's `Font.register` throws if called more
 * than once for the same family. With multiple templates we'd hit that
 * easily if each template registered its own copy.
 *
 * Fonts are local files under apps/web/public/fonts/, not a remote URL.
 * This used to fetch from jsdelivr's mirror of google/fonts at render
 * time, and broke twice for two different reasons: first the URL
 * structure went stale (Google Fonts moved everything to single-file
 * variable fonts and 404'd the old per-weight paths), then later a
 * transient network hiccup on one cold-start font fetch got cached as a
 * permanent failure for the rest of that server process's life — @react-
 * pdf/fontkit doesn't retry a failed font load, so every export failed
 * instantly after that until the process restarted. A resume export
 * shouldn't depend on a live fetch to an external CDN at all; reading
 * the bytes off local disk removes the whole failure class instead of
 * just fixing whichever symptom broke most recently.
 *
 * `Font.register`'s `src` accepts a local filesystem path directly in
 * Node (no fetch involved) — resolved from apps/web's cwd since these
 * templates only ever render from within the apps/web server process.
 */

import { join } from 'node:path';
import { Font } from '@react-pdf/renderer';

let registered = false;

// @react-pdf/font's FontSource dispatches on the *shape* of `src`: known
// standard-font name, data: URL string, http(s) URL string, else it
// treats it as a local path and hands it straight to `fontkit.open(src)`
// — which does its own file read. It must stay a plain string; handing
// it an already-read Buffer instead breaks the isDataUrl() string-typed
// sniff that string paths happen to pass through harmlessly (a Buffer
// doesn't have .substring(), which isDataUrl calls internally).
function fontPath(filename: string): string {
  return join(process.cwd(), 'public', 'fonts', filename);
}

export function ensureFontsRegistered(): void {
  if (registered) return;
  registered = true;

  const heebo = fontPath('Heebo-Variable.ttf');
  const inter = fontPath('Inter-Variable.ttf');
  const notoArabic = fontPath('NotoSansArabic-Variable.ttf');

  // Heebo — primary Hebrew face. Covers Hebrew + Latin per Google Fonts.
  Font.register({
    family: 'Heebo',
    fonts: [
      { src: heebo, fontWeight: 400 },
      { src: heebo, fontWeight: 500 },
      { src: heebo, fontWeight: 600 },
      { src: heebo, fontWeight: 700 },
    ],
  });

  // Inter — English-only fallback / classic template body. Used for the
  // Minimalist template which targets English-language tech roles.
  // Inter also covers Cyrillic for Russian resumes.
  Font.register({
    family: 'Inter',
    fonts: [
      { src: inter, fontWeight: 400 },
      { src: inter, fontWeight: 500 },
      { src: inter, fontWeight: 600 },
      { src: inter, fontWeight: 700 },
    ],
  });

  // Noto Sans Arabic — Arabic RTL face for ar-locale PDF templates.
  Font.register({
    family: 'NotoSansArabic',
    fonts: [
      { src: notoArabic, fontWeight: 400 },
      { src: notoArabic, fontWeight: 500 },
      { src: notoArabic, fontWeight: 600 },
      { src: notoArabic, fontWeight: 700 },
    ],
  });
}
