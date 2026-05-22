import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combine class names with tailwind-merge conflict resolution.
 * Used by all shadcn/ui components.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
