import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Pill shape + `ease-snappy` elastic-overshoot transition + a press
  // scale on every variant is the "liquid glass" button contract site-
  // wide — see design-system/components/buttons.html for the reference.
  'focus-visible:ring-brand-500 ease-snappy group relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100',
  {
    variants: {
      variant: {
        // Liquid gradient primary — colored glow deepens on hover/lift.
        // Used to also sweep a shine stripe across on hover (the
        // `::before` this variant no longer sets) — WebKit renders that
        // sweep's clip incorrectly whenever a backdrop-filter element
        // (e.g. the app header) is present anywhere on the page,
        // producing a flat rectangular smear past the pill. Confirmed
        // via A/B testing on glow-button.tsx's identical pattern before
        // removing it here too — see that file's comment for the full
        // investigation.
        default:
          'from-brand-500 to-accent-500 shadow-brand-500/30 hover:shadow-brand-500/45 bg-gradient-to-br text-white shadow-lg hover:-translate-y-0.5 hover:shadow-xl',
        destructive:
          'to-destructive text-destructive-foreground shadow-destructive/30 hover:shadow-destructive/45 focus-visible:ring-destructive bg-gradient-to-br from-red-500 shadow-lg hover:-translate-y-0.5 hover:shadow-xl',
        // Frosted glass — the `glass` surface utility (globals.css),
        // for use over gradients/imagery as well as plain backgrounds.
        outline: 'glass text-foreground hover:glass-strong hover:-translate-y-0.5',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm hover:-translate-y-0.5',
        ghost: 'text-foreground hover:bg-accent/70 hover:text-accent-foreground backdrop-blur-sm',
        link: 'text-brand-600 underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-8 px-3.5 text-xs',
        lg: 'h-12 px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
