'use client';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { ComponentProps, ReactNode } from 'react';

/**
 * Glassy CTA with a gradient-lit rim. This is the "flagship" treatment
 * — reserved for the single most important action on a screen (sign
 * in/up, the header CTA, "Start creating"). Everyday primary actions
 * (Save, Create, Subscribe, etc.) use ui/button.tsx's `default` variant
 * instead, which is deliberately calmer (plain translucent glass, no
 * rim) so the flagship treatment keeps standing out rather than being
 * diluted by dozens of repetitions.
 *
 * This used to be a solid brand-gradient fill with a separate blurred
 * halo span floating behind it — visually "glowy" rather than "glassy",
 * out of step with the rest of the app's translucent-glass surfaces,
 * and (via an animated shine-sweep span it also carried at the time) the
 * source of a WebKit-only rendering bug. Replaced with `glass-rim`
 * (globals.css) — a single translucent, backdrop-blurred fill with a
 * gradient border rather than a flat one, so the edge catches light the
 * way an actual piece of glass would. No floating halo, no extra
 * layered spans: just background/border/backdrop-filter on the element
 * itself, which is the same class of technique already confirmed safe
 * in WebKit (see ui/button.tsx's `default` variant for the fuller
 * investigation this traces back to).
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

  // No extra spans needed — `glass-rim` puts the fill and the gradient
  // border on this element's own background/border, so content can sit
  // directly inside without a z-index stacking dance.
  const inner = (
    <>
      {loading && (
        <span
          aria-hidden
          className="border-current/30 h-4 w-4 animate-spin rounded-full border-2 border-t-current"
        />
      )}
      {children}
    </>
  );

  const primaryClass = cn(
    'glass-rim text-brand-800 ease-snappy group relative inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100 dark:text-white',
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
