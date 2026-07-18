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
}: {
  href: LinkHref;
  children: ReactNode;
  size?: 'md' | 'lg';
  variant?: 'primary' | 'ghost';
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
      className={`ease-snappy group relative inline-flex items-center justify-center gap-2 rounded-full font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.96] ${sizeClass}`}
    >
      {/* Glow ring — deliberately extends past the pill's edge to read as
          a soft halo, not a hard-edged fill. The parent must NOT clip
          overflow, or this gets cut into a flat rectangular box instead
          of a blurred glow (this was the "shallow rectangle" artifact
          around the sign-in/CTA buttons). The two layers below don't
          need ancestor clipping — each already paints its own exact
          rounded-full shape, so they can't spill regardless.
          pointer-events-none on all three: they're decorative overlays
          inside an <a>, and since the glow ring intentionally spills
          outside the link's own box, an adjacent element (e.g. the
          mobile-header burger, which sits close by on narrow viewports)
          can end up underneath that spill — without this, the glow
          silently steals clicks meant for whatever's actually there. */}
      <span
        aria-hidden
        className="from-brand-500 to-brand-500 pointer-events-none absolute -inset-0.5 rounded-full bg-gradient-to-r via-purple-500 opacity-75 blur-md transition group-hover:opacity-100 group-hover:blur-lg"
      />
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
