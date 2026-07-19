'use client';

import type { ReactNode } from 'react';
import { useHideOnScroll } from '@/lib/hooks/use-hide-on-scroll';

/**
 * Sticky positioning + auto-hide-on-scroll wrapper shared by the
 * marketing and app headers — the floating glass nav bar used to sit
 * fixed at the top permanently, which on long pages meant it never got
 * out of the way of the content underneath it. Now it slides off-screen
 * on scroll-down and slides back on scroll-up (or near the top).
 *
 * Split out as its own client component (rather than folding the scroll
 * hook straight into MarketingHeader) so MarketingHeader can stay a
 * server component — it reads the session server-side; see its own doc
 * comment for why that matters. Children render as normal, including
 * server-rendered content passed down through this client boundary.
 *
 * `-translate-y-[150%]` is relative to the header's own height, so it
 * clears the pill (~h-16) plus its `top`/`mt` offset with margin to
 * spare without a hardcoded pixel value that'd drift if either changes.
 */
export function ScrollHideHeader({ children }: { children: ReactNode }) {
  const hidden = useHideOnScroll();

  return (
    <div
      className={`ease-smooth sticky top-3 z-40 mt-3 px-3 transition-transform duration-300 sm:top-4 sm:mt-4 sm:px-4 ${
        hidden ? '-translate-y-[150%]' : 'translate-y-0'
      }`}
    >
      {children}
    </div>
  );
}
