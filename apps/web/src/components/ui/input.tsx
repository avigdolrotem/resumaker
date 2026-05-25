import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'border-input bg-background text-foreground flex h-10 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors',
        'placeholder:text-muted-foreground',
        'focus-visible:ring-brand-500 focus-visible:outline-none focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-red-500 aria-invalid:focus-visible:ring-red-500',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
