/**
 * Loading spinner for the liquid-glass redesign — a conic-gradient
 * ring instead of a plain border-spinner, matching
 * design-system/components/loading.html. Pure CSS, server-renderable.
 */
export function LiquidSpinner({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-liquid-spin rounded-full ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        background: 'conic-gradient(from 0deg, transparent, var(--color-brand-400))',
        WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))`,
        mask: `radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))`,
      }}
    />
  );
}
