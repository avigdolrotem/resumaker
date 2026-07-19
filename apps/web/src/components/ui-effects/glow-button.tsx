'use client';

import { Link } from '@/i18n/navigation';
import type { ComponentProps, ReactNode } from 'react';

/**
 * High-contrast CTA with a soft blurred halo — same recipe as the
 * auth-flow submit buttons (sign-in/sign-up/etc.), so the "glow" reads
 * as one consistent material across the app rather than two different
 * effects that happen to both be purple.
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
      {/* Soft blurred halo — a separate absolutely-positioned span
          spilling past the pill's edge (`-inset-0.5 blur-md`), same
          gradient recipe the auth-flow submit buttons already use.
          This looks softer/more "glass" than a plain box-shadow glow
          and — importantly — tested clean everywhere a box-shadow
          glow wasn't: reproduced the header/examples-page artifact
          across several variants (custom box-shadow at various blur
          radii, this exact span with different DOM order, explicit
          z-index, stacking-context isolation) and the ONE thing that
          consistently broke was the animated shine-sweep this button
          used to also have — a gradient stripe translating across on
          hover. This static blurred halo, with no shine-sweep, was
          clean in every configuration tested, including the header
          (where an earlier, less isolated test of a similar span had
          wrongly implicated it) and the examples page's "Build your
          own" (the one case that reliably reproduced the bug). */}
      <span
        aria-hidden
        className="from-brand-500 to-brand-500 ease-snappy pointer-events-none absolute -inset-0.5 rounded-full bg-gradient-to-r via-purple-500 opacity-75 blur-md transition-opacity duration-300 group-hover:opacity-100"
      />
      {/* Solid background */}
      <span
        aria-hidden
        className="from-brand-600 to-brand-800 pointer-events-none absolute inset-0 overflow-hidden rounded-full bg-gradient-to-br"
      />
      {/* Content above all layers */}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}
