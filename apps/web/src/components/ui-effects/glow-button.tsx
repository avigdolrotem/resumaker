'use client';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { ComponentProps, ReactNode } from 'react';

/**
 * High-contrast CTA with a soft blurred halo. This is the "flagship"
 * treatment — reserved for the single most important action on a
 * screen (sign in/up, the header CTA, "Start creating"). Everyday
 * primary actions (Save, Create, Subscribe, etc.) use ui/button.tsx's
 * `default` variant instead, which is deliberately calmer (translucent
 * glass + a purple tint, no halo) so the flagship treatment keeps
 * standing out rather than being diluted by dozens of repetitions.
 *
 * Polymorphic: pass `href` for a navigation link, or `type="submit"`
 * (+ optionally `loading`/`disabled`) for a form submit button — same
 * visual recipe either way, which is the whole point: this used to be
 * hand-duplicated across 4 auth-flow pages (sign-in/sign-up/forgot-
 * password/reset-password) as raw JSX, each an independent copy that
 * could (and did) drift from the Link-based version used in the
 * header/hero/examples.
 *
 * Uses next-intl's Link so locale-prefixed URLs stay correct.
 */
type LinkHref = ComponentProps<typeof Link>['href'];

type GlowButtonProps = {
  children: ReactNode;
  size?: 'md' | 'lg';
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  /** Extra classes merged in via tailwind-merge — e.g. `w-full` for a form CTA. */
  className?: string;
} & (
  | { href: LinkHref; type?: never; onClick?: never; disabled?: never }
  | { href?: never; type?: 'button' | 'submit'; onClick?: () => void; disabled?: boolean }
);

export function GlowButton({
  href,
  type = 'button',
  onClick,
  disabled = false,
  loading = false,
  children,
  size = 'lg',
  variant = 'primary',
  className,
}: GlowButtonProps) {
  const sizeClass = size === 'lg' ? 'h-14 px-8 text-base' : 'h-11 px-6 text-sm';

  if (variant === 'ghost') {
    const ghostClass = cn(
      'glass hover:glass-strong text-foreground ease-snappy group relative inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-60',
      sizeClass,
      className,
    );
    return href ? (
      <Link href={href} className={ghostClass}>
        {children}
      </Link>
    ) : (
      <button type={type} onClick={onClick} disabled={disabled} className={ghostClass}>
        {children}
      </button>
    );
  }

  // Soft blurred halo — a separate absolutely-positioned span spilling
  // past the pill's edge (`-inset-0.5 blur-md`). This looks softer/
  // more "glass" than a plain box-shadow glow and — importantly —
  // tested clean everywhere a box-shadow glow wasn't: reproduced the
  // header/examples-page artifact across several variants (custom
  // box-shadow at various blur radii, this exact span with different
  // DOM order, explicit z-index, stacking-context isolation) and the
  // ONE thing that consistently broke was an animated shine-sweep this
  // button used to also have — a gradient stripe translating across on
  // hover. This static blurred halo, with no shine-sweep, was clean in
  // every configuration tested, including the header (where an
  // earlier, less isolated test of a similar span had wrongly
  // implicated it) and the examples page's "Build your own" (the one
  // case that reliably reproduced the bug).
  const inner = (
    <>
      <span
        aria-hidden
        className="from-brand-500 to-brand-500 ease-snappy pointer-events-none absolute -inset-0.5 rounded-full bg-gradient-to-r via-purple-500 opacity-75 blur-md transition-opacity duration-300 group-hover:opacity-100 group-disabled:opacity-30"
      />
      {/* Solid background */}
      <span
        aria-hidden
        className="from-brand-600 to-brand-800 pointer-events-none absolute inset-0 overflow-hidden rounded-full bg-gradient-to-br"
      />
      {/* Content above all layers */}
      <span className="relative z-10 inline-flex items-center gap-2">
        {loading && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {children}
      </span>
    </>
  );

  const primaryClass = cn(
    'ease-snappy group relative inline-flex items-center justify-center gap-2 rounded-full font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.96] disabled:pointer-events-none disabled:hover:translate-y-0',
    sizeClass,
    className,
  );

  return href ? (
    <Link href={href} className={primaryClass}>
      {inner}
    </Link>
  ) : (
    <button type={type} onClick={onClick} disabled={disabled} className={primaryClass}>
      {inner}
    </button>
  );
}
