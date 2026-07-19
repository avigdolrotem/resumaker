'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * True while the page is being actively scrolled down past `threshold`
 * px from the top; flips back to false on any upward scroll, or when
 * back within `threshold` of the top. Drives the floating glass headers
 * hiding themselves out of the way on long pages instead of
 * permanently occluding content, then reappearing as soon as the user
 * scrolls back up to look for it.
 *
 * rAF-throttled so the scroll listener never does more than one state
 * check per frame.
 */
export function useHideOnScroll(threshold = 80) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;
    function update() {
      const y = window.scrollY;
      setHidden(y > threshold && y > lastY.current);
      lastY.current = y;
      ticking.current = false;
    }
    function onScroll() {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(update);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return hidden;
}
