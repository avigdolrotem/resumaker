'use client';

import { Link } from '@/i18n/navigation';
import type { ComponentProps, ReactNode } from 'react';

/**
 * High-contrast CTA with a soft brand-tinted drop shadow that deepens
 * on hover.
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
      // The glow has gone through two prior implementations, both
      // eventually shown to be WebKit bugs: (1) a separate absolutely-
      // positioned blurred span (`-inset-0.5 blur-md`) rendered its
      // rectangular filter bounding box as a flat-edged smear past the
      // pill; (2) replacing it with a large custom box-shadow
      // (`shadow-[0_0_28px_6px_...]`) fixed that but turned out to
      // still clip incorrectly specifically when a backdrop-filter
      // element (the header) was present anywhere on the page. A third
      // suspect — the animated shine-sweep span below, translating a
      // gradient stripe across on hover — was confirmed as an
      // INDEPENDENT trigger of the same class of bug: A/B tested with
      // zero box-shadow at all, the sweep alone still produced the
      // artifact; removing the sweep and using this smaller,
      // Tailwind-preset shadow (matching ui/button.tsx's default
      // variant and the pricing cards' CTA) was clean in every test,
      // including the one case (the examples page's "Build your own",
      // reached via a long scroll) that reliably reproduced the bug.
      // No more shine-sweep, no more oversized custom blur — just a
      // conventional shadow that happens to be brand-tinted.
      className={`ease-snappy shadow-brand-500/40 hover:shadow-brand-500/60 group relative inline-flex items-center justify-center gap-2 rounded-full font-semibold text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.96] ${sizeClass}`}
    >
      {/* Solid background */}
      <span
        aria-hidden
        className="from-brand-600 to-brand-800 pointer-events-none absolute inset-0 overflow-hidden rounded-full bg-gradient-to-br"
      />
      {/* Content above the background layer */}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}
