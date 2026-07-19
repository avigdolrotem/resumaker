/**
 * Shared font registration for resume PDF templates.
 *
 * Why centralized: @react-pdf's `Font.register` throws if called more
 * than once for the same family. With multiple templates we'd hit that
 * easily if each template registered its own copy.
 *
 * Every PDF export was failing with a generic "PDF render failed" —
 * found by testing these exact URLs directly: all three families'
 * `static/<Family>-<Weight>.ttf` per-weight files 404 now. Google Fonts
 * migrated its whole catalog (including these three) to single-file
 * variable fonts at some point and removed the old `static/` per-weight
 * directories; this registration was never updated and had been
 * pointing at a dead URL structure ever since — this wasn't
 * network-flaky, it failed on every single export, deterministically.
 *
 * Fixed by pointing at the variable-font file each family now actually
 * ships (`<Family>[axis...].ttf`, no `static/` prefix) and registering
 * it once per weight — @react-pdf embeds fonts via fontkit, which
 * instances the requested weight out of the variable font's `wght` axis
 * per `fontWeight` entry, same external registration shape as before.
 *
 * Source: jsdelivr's mirror of google/fonts (OFL-licensed). If you want
 * air-gapped builds, mirror these into apps/web/public/fonts/ and
 * rewrite the URLs — but prefer pinning a released fontsource/google-
 * fonts npm package's CDN URL over the live GitHub repo if this breaks
 * again, since @main can and does get reorganized without warning.
 */

import { Font } from '@react-pdf/renderer';

let registered = false;

const HEEBO_URL = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/heebo/Heebo%5Bwght%5D.ttf';

const INTER_URL =
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf';

const NOTO_ARABIC_URL =
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansarabic/NotoSansArabic%5Bwdth%2Cwght%5D.ttf';

export function ensureFontsRegistered(): void {
  if (registered) return;
  registered = true;

  // Heebo — primary Hebrew face. Covers Hebrew + Latin per Google Fonts.
  Font.register({
    family: 'Heebo',
    fonts: [
      { src: HEEBO_URL, fontWeight: 400 },
      { src: HEEBO_URL, fontWeight: 500 },
      { src: HEEBO_URL, fontWeight: 600 },
      { src: HEEBO_URL, fontWeight: 700 },
    ],
  });

  // Inter — English-only fallback / classic template body. Used for the
  // Minimalist template which targets English-language tech roles.
  // Inter also covers Cyrillic for Russian resumes.
  Font.register({
    family: 'Inter',
    fonts: [
      { src: INTER_URL, fontWeight: 400 },
      { src: INTER_URL, fontWeight: 500 },
      { src: INTER_URL, fontWeight: 600 },
      { src: INTER_URL, fontWeight: 700 },
    ],
  });

  // Noto Sans Arabic — Arabic RTL face for ar-locale PDF templates.
  Font.register({
    family: 'NotoSansArabic',
    fonts: [
      { src: NOTO_ARABIC_URL, fontWeight: 400 },
      { src: NOTO_ARABIC_URL, fontWeight: 500 },
      { src: NOTO_ARABIC_URL, fontWeight: 600 },
      { src: NOTO_ARABIC_URL, fontWeight: 700 },
    ],
  });
}
