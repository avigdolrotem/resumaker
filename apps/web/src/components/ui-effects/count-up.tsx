'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts up from 0 to `value` over `duration` ms when it first enters
 * the viewport. Uses IntersectionObserver to fire once, then sticks
 * at the final value.
 *
 * `value` is a string so it can include suffixes ("48", "<3s", "100%").
 * If the string is a pure positive integer, we animate; otherwise the
 * final value is shown immediately.
 */
export function CountUp({
  value,
  duration = 1200,
  className,
}: {
  value: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayed, setDisplayed] = useState<string>(value);
  const [hasAnimated, setHasAnimated] = useState(false);

  const numeric = /^\d+$/.test(value) ? parseInt(value, 10) : null;

  useEffect(() => {
    if (numeric === null) {
      // Non-numeric (e.g. "<3s") — just show it.
      setDisplayed(value);
      return;
    }
    setDisplayed('0');

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!hasAnimated && entries[0]?.isIntersecting) {
          setHasAnimated(true);
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / duration);
            // ease-out cubic so the counter slows near the end
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(numeric * eased);
            setDisplayed(String(current));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration, numeric, hasAnimated]);

  return (
    <span ref={ref} className={className}>
      {displayed}
    </span>
  );
}
