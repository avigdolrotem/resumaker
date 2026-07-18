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
      className={`ease-snappy group relative inline-flex items-center justify-center gap-2 rounded-full font-semibold text-white shadow-[0_0_20px_2px_rgba(139,92,246,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_28px_6px_rgba(139,92,246,0.75)] active:scale-[0.96] ${sizeClass}`}
    >
      {/* The glow used to be a separate absolutely-positioned, blurred
          span spilling past the pill's edge (`-inset-0.5 blur-md`) —
          that's the standard trick for a soft halo, and it's what
          components/ui/button.tsx's outline variant still does. But
          WebKit/Safari specifically was rendering that span's
          rectangular filter bounding box as a visible flat-edged smear
          past the button instead of a soft round glow (confirmed via
          webkit-engine screenshots — Chromium rendered it fine, so this
          never showed up in prior testing). A box-shadow glow on the
          link itself sidesteps the whole class of bug: box-shadow is
          native to the border-radius, there's no separate filtered
          element whose bounding box can show through. Matches how
          ui/button.tsx's default variant already does its shadow glow
          (shadow-brand-500/30 hover:shadow-brand-500/45) — same idea,
          just a stronger/more diffuse tint since this is the
          higher-contrast "glow" CTA specifically. */}
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
