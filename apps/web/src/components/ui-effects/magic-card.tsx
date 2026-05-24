'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Card that tracks the cursor and reveals a soft radial gradient
 * underneath it — Vercel/Linear/Magic-UI's signature card-with-glow
 * effect.
 *
 * Tracks mouse position via a single CSS variable (`--mx`, `--my`) so
 * the rerender cost is zero (React doesn't re-render; we just set
 * inline-style variables on the element directly).
 *
 * Falls back to a plain border on touch devices (no cursor).
 */
export function MagicCard({
  children,
  className,
  glowColor = 'rgba(109, 40, 217, 0.25)',
}: {
  children: ReactNode;
  className?: string;
  glowColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        el.style.setProperty('--my', `${e.clientY - rect.top}px`);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`hover:border-brand-300 group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur-sm transition-colors ${className ?? ''}`}
      style={
        {
          '--glow-color': glowColor,
        } as React.CSSProperties
      }
    >
      {/* Cursor-tracking glow. `radial-gradient` at the (mx, my) point.
          Opacity drives the in/out effect — base 0, hover 1. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(400px circle at var(--mx, 50%) var(--my, 50%), var(--glow-color), transparent 40%)',
        }}
      />
      {/* Subtle scale on hover so it feels alive even without mouse-move */}
      <div
        className={`relative transition-transform duration-300 ${hovered ? 'scale-[1.01]' : ''}`}
      >
        {children}
      </div>
    </div>
  );
}
