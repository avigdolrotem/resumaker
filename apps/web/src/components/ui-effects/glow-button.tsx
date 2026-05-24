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
        className={`hover:border-brand-300/60 hover:text-brand-700 group relative inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/5 font-medium text-neutral-700 backdrop-blur transition hover:bg-white ${sizeClass}`}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold text-white transition-all duration-300 ${sizeClass}`}
    >
      {/* Glow ring */}
      <span
        aria-hidden
        className="from-brand-500 to-brand-500 absolute -inset-0.5 rounded-xl bg-gradient-to-r via-purple-500 opacity-75 blur-md transition group-hover:opacity-100 group-hover:blur-lg"
      />
      {/* Solid background */}
      <span
        aria-hidden
        className="from-brand-600 to-brand-800 absolute inset-0 rounded-xl bg-gradient-to-br"
      />
      {/* Shine pass on hover */}
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full rounded-xl bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      {/* Content above all layers */}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}
