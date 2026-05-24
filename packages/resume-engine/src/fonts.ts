/**
 * Shared font registration for resume PDF templates.
 *
 * Why centralized: @react-pdf's `Font.register` throws if called more
 * than once for the same family. With multiple templates we'd hit that
 * easily if each template registered its own copy.
 *
 * Why per-weight URLs: the previous registration pointed all 3 weight
 * variants at the same Regular TTF, so bold/medium text silently
 * rendered at Regular weight. Each weight needs its own file URL.
 *
 * Source: jsdelivr's mirror of google/fonts (OFL-licensed). Stable URLs.
 * If you want air-gapped builds, mirror these into apps/web/public/fonts/
 * and rewrite the URLs.
 */

import { Font } from '@react-pdf/renderer';

let registered = false;

const HEEBO_BASE = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/heebo/static';

const INTER_BASE = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/static';

const NOTO_ARABIC_BASE = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansarabic/static';

export function ensureFontsRegistered(): void {
  if (registered) return;
  registered = true;

  // Heebo — primary Hebrew face. Covers Hebrew + Latin per Google Fonts.
  Font.register({
    family: 'Heebo',
    fonts: [
      { src: `${HEEBO_BASE}/Heebo-Regular.ttf`, fontWeight: 400 },
      { src: `${HEEBO_BASE}/Heebo-Medium.ttf`, fontWeight: 500 },
      { src: `${HEEBO_BASE}/Heebo-SemiBold.ttf`, fontWeight: 600 },
      { src: `${HEEBO_BASE}/Heebo-Bold.ttf`, fontWeight: 700 },
    ],
  });

  // Inter — English-only fallback / classic template body. Used for the
  // Minimalist template which targets English-language tech roles.
  // Inter also covers Cyrillic for Russian resumes.
  Font.register({
    family: 'Inter',
    fonts: [
      { src: `${INTER_BASE}/Inter-Regular.ttf`, fontWeight: 400 },
      { src: `${INTER_BASE}/Inter-Medium.ttf`, fontWeight: 500 },
      { src: `${INTER_BASE}/Inter-SemiBold.ttf`, fontWeight: 600 },
      { src: `${INTER_BASE}/Inter-Bold.ttf`, fontWeight: 700 },
    ],
  });

  // Noto Sans Arabic — Arabic RTL face for ar-locale PDF templates.
  Font.register({
    family: 'NotoSansArabic',
    fonts: [
      { src: `${NOTO_ARABIC_BASE}/NotoSansArabic-Regular.ttf`, fontWeight: 400 },
      { src: `${NOTO_ARABIC_BASE}/NotoSansArabic-Medium.ttf`, fontWeight: 500 },
      { src: `${NOTO_ARABIC_BASE}/NotoSansArabic-SemiBold.ttf`, fontWeight: 600 },
      { src: `${NOTO_ARABIC_BASE}/NotoSansArabic-Bold.ttf`, fontWeight: 700 },
    ],
  });
}
