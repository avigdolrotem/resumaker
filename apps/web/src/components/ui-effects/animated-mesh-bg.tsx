'use client';

import { useEffect, useState } from 'react';

/**
 * Animated gradient mesh — three large blurry blobs that drift slowly.
 * The aiapply.io / Vercel / Linear hero-background pattern: gives the
 * page a sense of life without being distracting.
 *
 * Pure CSS (transform + animation), no JS RAF loop, no canvas — cheap
 * to run, gentle on the GPU. Respects prefers-reduced-motion by
 * freezing the blobs in their initial positions.
 *
 * Uses a `mounted` guard for the same reason scroll-reveal does:
 * `useEffect` flipping `mounted` after hydration avoids a
 * server-rendered-vs-client-rendered class mismatch warning that React
 * would surface in dev.
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
      <div
        className={`from-brand-400/40 absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-gradient-to-br via-purple-400/30 to-pink-300/20 blur-3xl ${mounted ? 'animate-blob-1' : ''}`}
      />
      <div
        className={`to-brand-400/40 absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-pink-300/30 via-purple-400/30 blur-3xl ${mounted ? 'animate-blob-2' : ''}`}
      />
      <div
        className={`via-brand-500/30 absolute bottom-0 left-1/4 h-[450px] w-[450px] rounded-full bg-gradient-to-tl from-purple-500/30 to-cyan-300/20 blur-3xl ${mounted ? 'animate-blob-3' : ''}`}
      />
    </div>
  );
}
