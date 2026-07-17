'use client';

import { useEffect, useState } from 'react';

/**
 * Ambient liquid background — three blobs that drift slowly and fuse
 * into one continuous surface via an SVG "goo" filter (blur then
 * sharpen the alpha channel) instead of just crossing as translucent
 * circles. Reference: design-system/components/liquid-background.html.
 * Used as the base atmosphere behind glass panels site-wide, not just
 * the marketing hero.
 *
 * Pure CSS (transform + animation) plus one static SVG filter, no JS
 * RAF loop, no canvas — cheap to run, gentle on the GPU. The global
 * `prefers-reduced-motion` rule in globals.css freezes the blobs; the
 * `mounted` guard here only exists to avoid a server/client class
 * mismatch on first paint (same reason scroll-reveal.tsx uses one).
 */
export function AnimatedMeshBg({
  className,
  intensity = 'normal',
}: {
  className?: string;
  intensity?: 'subtle' | 'normal' | 'vivid';
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const opacity = {
    subtle: 'opacity-40',
    normal: 'opacity-60',
    vivid: 'opacity-90',
  }[intensity];

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${opacity} ${className ?? ''}`}
    >
      {/* Filter must be defined once per document; harmless if this
          component renders more than once — the browser dedupes by id
          and every instance references the same `url(#liquid-goo)`. */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <filter id="liquid-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -11"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      <div className="absolute inset-0" style={{ filter: 'url(#liquid-goo)' }}>
        <div
          className={`from-brand-400/50 absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-gradient-to-br via-purple-400/40 to-pink-300/30 mix-blend-screen blur-3xl ${mounted ? 'animate-blob-1' : ''}`}
        />
        <div
          className={`to-brand-400/50 absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-pink-300/40 via-purple-400/40 mix-blend-screen blur-3xl ${mounted ? 'animate-blob-2' : ''}`}
        />
        <div
          className={`via-brand-500/40 absolute bottom-0 left-1/4 h-[450px] w-[450px] rounded-full bg-gradient-to-tl from-purple-500/40 to-cyan-300/30 mix-blend-screen blur-3xl ${mounted ? 'animate-blob-3' : ''}`}
        />
      </div>
    </div>
  );
}
