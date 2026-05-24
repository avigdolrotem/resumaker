/**
 * Subtle background grid — the Linear/Vercel landing-page pattern.
 *
 * SVG `<pattern>` repeated over the background, masked at the edges
 * with a radial gradient so the grid fades to nothing at the corners
 * (Vercel's "soft grid" effect). Pure CSS background, no JS at all.
 *
 * Server component — no client overhead.
 */
export function GridPattern({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ''}`}
      style={{
        maskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, #000 30%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, #000 30%, transparent 70%)',
      }}
    >
      <defs>
        <pattern id="grid-pattern" width={size} height={size} patternUnits="userSpaceOnUse">
          <path
            d={`M ${size} 0 L 0 0 0 ${size}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.15"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-pattern)" className="text-brand-900" />
    </svg>
  );
}
