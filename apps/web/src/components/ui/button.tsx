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
        // Translucent glass + a purple tint — the "everyday primary"
        // button, used for the dozens of ordinary primary actions
        // (Save, Create, Subscribe, etc.) across the app. Deliberately
        // calmer than GlowButton's solid-gradient + blurred-halo look,
        // which is reserved for the single flagship CTA per screen
        // (sign in/up, the header CTA, "Start creating") — using the
        // strong glow treatment for every primary button everywhere
        // would dilute it and fight the app's own "liquid glass"
        // design language (see the LIQUID GLASS block in globals.css)
        // more than a plain gradient button already did.
        //
        // Backdrop-filter + box-shadow on a rounded-full element is
        // confirmed safe as long as there's no separate absolutely-
        // positioned/transformed child span involved — this variant has
        // none (no shine-sweep, no blurred glow-ring). Verified via the
        // same WebKit reproduction that caught the shine-sweep bug
        // (long scroll + hover, dark theme): a plain rounded-full glass
        // button with an ~32px box-shadow (--shadow-glass) showed no
        // artifact. This used to have an animated shine-sweep (the
        // `::before` this variant no longer sets) — see glow-button.tsx
        // for the full investigation into why that specifically was
        // the unsafe part, not backdrop-filter/box-shadow in general.
        default:
          'bg-brand-500/10 hover:bg-brand-500/20 dark:bg-brand-400/15 dark:hover:bg-brand-400/25 border-brand-500/30 dark:border-brand-400/35 text-brand-700 dark:text-brand-100 shadow-glass border backdrop-blur-[var(--blur-glass-lg)] hover:-translate-y-0.5',
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
