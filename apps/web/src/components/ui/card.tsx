import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Whether this card should lift + grow its shadow on hover — the
   * "liquid settle" affordance for clickable cards (dashboard tiles,
   * template picker). Defaults to true to preserve existing behavior
   * everywhere; set false for cards that are just a static, read-only
   * surface (e.g. ResumePreview) — otherwise resting the mouse over
   * them while reading reads as a false "this is clickable" signal.
   */
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Frosted glass surface (globals.css `glass` utility) over the
        // semantic `bg-card` fallback, so cards read as translucent
        // glass wherever there's something behind them to blur, and
        // still look correct if `backdrop-filter` isn't supported.
        // `duration-slow`/`ease-smooth` = the "liquid settle" curve for
        // hover lift, per design-system/components/cards.html.
        'glass bg-card/70 text-card-foreground ease-smooth relative overflow-hidden rounded-2xl transition-all duration-500',
        interactive && 'hover:shadow-glass-lg hover:-translate-y-1',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('text-xl font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-muted-foreground text-sm', className)} {...props} />
  ),
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
