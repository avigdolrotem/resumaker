'use client';

import { Link } from '@/i18n/navigation';
import type { ComponentProps, ReactNode } from 'react';

/**
 * High-contrast CTA with a soft outer glow and an animated shine pass
 * on hover. The shine is a translateX'd diagonal stripe — same trick
 * Vercel/Linear use on their hero CTAs.
 *
 * Uses next-intl's Link so locale-prefixed URLs stay correct.
 */
type LinkHref = ComponentProps<typeof Link>['href'];

export function GlowButton({
  href,
  children,
  size = 'lg',
  variant = 'primary',
  glow = true,
}: {
  href: LinkHref;
  children: ReactNode;
  size?: 'md' | 'lg';
  variant?: 'primary' | 'ghost';
  /**
   * Set false to drop the ambient box-shadow glow while keeping
   * everything else (gradient fill, shine sweep, hover lift). WebKit
   * fails to clip a blurred, non-inset box-shadow to a rounded-full
   * element's curve when that element sits inside an ancestor with
   * `backdrop-filter` — confirmed via direct comparison in dark theme:
   * this exact glow renders as a clean soft halo on the homepage hero
   * CTA (no backdrop-filter ancestor) but as a flat rectangular smear
   * on the header's Sign in CTA (nested inside the header's
   * `backdrop-filter`), independent of the shadow's blur radius —
   * varying blur 0-28px made no difference, only removing the shadow
   * did. Both header components pass `glow={false}` for exactly this
   * reason; the hero/examples usages keep the default glow since
   * they're not inside a backdrop-filter surface.
   */
  glow?: boolean;
}) {
  const sizeClass = size === 'lg' ? 'h-14 px-8 text-base' : 'h-11 px-6 text-sm';

  if (variant === 'ghost') {
    return (
      <Link
        href={href}
        className={`glass hover:glass-strong text-foreground ease-snappy group relative inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.96] ${sizeClass}`}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`ease-snappy group relative inline-flex items-center justify-center gap-2 rounded-full font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.96] ${glow ? 'shadow-[0_0_20px_2px_rgba(139,92,246,0.55)] hover:shadow-[0_0_28px_6px_rgba(139,92,246,0.75)]' : ''} ${sizeClass}`}
    >
      {/* The glow used to be a separate absolutely-positioned, blurred
          span spilling past the pill's edge (`-inset-0.5 blur-md`) —
          that's the standard trick for a soft halo, and it's what
          components/ui/button.tsx's outline variant still does. WebKit
          rendered that span's rectangular filter bounding box as a
          flat-edged smear past the button instead of a soft round glow,
          so it was switched to a box-shadow directly on the link
          instead (native to the border-radius, no separate filtered
          element to leak). That fixed it standalone, but NOT inside a
          `backdrop-filter` ancestor: WebKit also fails to clip a
          blurred, non-inset box-shadow to a rounded-full descendant's
          curve when an ancestor has backdrop-filter — same rectangular
          smear, just one level up the DOM. Confirmed by A/B — the
          identical shadow classes render clean on the hero CTA (no
          backdrop-filter ancestor) and broken on the header CTA (is
          one), independent of blur radius. Hence the `glow` prop: off
          for header usage, on everywhere else. */}
      {/* Solid background */}
      <span
        aria-hidden
        className="from-brand-600 to-brand-800 pointer-events-none absolute inset-0 overflow-hidden rounded-full bg-gradient-to-br"
      />
      {/* Shine pass on hover — clipped to its own rounded box so the
          sweep doesn't spill past the corners. */}
      <span
        aria-hidden
        className="ease-snappy pointer-events-none absolute inset-0 -translate-x-full overflow-hidden rounded-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      {/* Content above all layers */}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}
