import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'border-input bg-background/60 text-foreground ease-smooth flex min-h-[80px] w-full rounded-xl border px-3.5 py-2.5 text-sm shadow-sm backdrop-blur-sm transition-all duration-300',
        'placeholder:text-muted-foreground',
        'focus-visible:border-brand-400/60 focus-visible:bg-background focus-visible:ring-brand-500/18 focus-visible:outline-none focus-visible:ring-4',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'resize-y',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
