import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Generic frosted-glass surface for anything bigger than a `Card` —
 * hero panels, page-level containers, modal shells, sidebar rails.
 * Wraps the `glass`/`glass-subtle`/`glass-strong` utilities
 * (globals.css) so call sites pick an intensity instead of hand-rolling
 * blur/border/shadow. See design-system/foundations/tokens.html for the
 * three intensities side by side.
 */
export const GlassPanel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    intensity?: 'subtle' | 'default' | 'strong';
    /** Elastic pop-in on mount — off by default since most panels are
     *  static chrome, not something appearing in response to an action. */
    animateIn?: boolean;
  }
>(({ className, intensity = 'default', animateIn = false, ...props }, ref) => {
  const surface = {
    subtle: 'glass-subtle',
    default: 'glass',
    strong: 'glass-strong',
  }[intensity];

  return (
    <div
      ref={ref}
      className={cn(surface, 'rounded-3xl', animateIn && 'animate-liquid-pop', className)}
      {...props}
    />
  );
});
GlassPanel.displayName = 'GlassPanel';
