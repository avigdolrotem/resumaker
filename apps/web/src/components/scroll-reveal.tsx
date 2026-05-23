'use client';

import { motion, useReducedMotion, type MotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Wraps children in a fade-up-on-scroll animation.
 * Respects prefers-reduced-motion (no animation if user opted out).
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

  if (prefersReducedMotion) {
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
