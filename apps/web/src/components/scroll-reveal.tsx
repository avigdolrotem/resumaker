'use client';

import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * Wraps children in a fade-up-on-scroll animation.
 * Respects prefers-reduced-motion (no animation if user opted out).
 *
 * The `mounted` guard prevents a hydration mismatch: `useReducedMotion`
 * returns `null` on the server and on the FIRST client render, then
 * flips to `true|false` after layout. Without the guard, framer-motion
 * applies `initial={{ opacity: 0 }}` inline styles on the client only,
 * which React's hydrator flags as a content mismatch with the
 * server-rendered HTML (where no inline style exists). Rendering the
 * plain wrapper on first paint and swapping to motion on the second
 * tick avoids that.
 */
export function ScrollReveal({
  children,
  delay = 0,
  className,
  as = 'div',
  ...rest
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'header';
} & MotionProps) {
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || prefersReducedMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
