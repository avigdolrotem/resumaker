/**
 * Text with a moving gradient. The gradient slowly scrolls across the
 * letters — high-end SaaS landing page accent (aiapply, Cursor, Vercel
 * all use this for hero headlines).
 *
 * Server-renderable. Pure CSS animation; reduced-motion users see a
 * static gradient.
 */
export function AnimatedGradientText({
  children,
  className,
  from = 'from-brand-600',
  via = 'via-purple-500',
  to = 'to-pink-500',
}: {
  children: React.ReactNode;
  className?: string;
  from?: string;
  via?: string;
  to?: string;
}) {
  return (
    <span
      className={`bg-gradient-to-r ${from} ${via} ${to} animate-gradient-x inline-block bg-clip-text text-transparent ${className ?? ''}`}
      style={{
        backgroundSize: '200% 100%',
      }}
    >
      {children}
    </span>
  );
}
