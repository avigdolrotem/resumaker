import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'border-input bg-background/60 text-foreground ease-smooth flex h-10 w-full rounded-xl border px-3.5 py-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-300',
        'placeholder:text-muted-foreground',
        'focus-visible:border-brand-400/60 focus-visible:bg-background focus-visible:ring-brand-500/18 focus-visible:outline-none focus-visible:ring-4',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-red-500 aria-invalid:focus-visible:ring-red-500/20',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
