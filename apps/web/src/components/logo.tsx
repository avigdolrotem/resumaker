import { Link } from '@/i18n/navigation';

/**
 * Brand logo: icon + optional wordmark.
 *
 * The icon SVG lives in `public/icon.svg` (white card on a purple
 * gradient with a green check). Both icon and wordmark are part of
 * the brand — we render them together by default so users build
 * recognition for both at once (same convention Stripe, Anthropic,
 * Linear use).
 *
 * Variants:
 *   - `full`  — icon + "Resumaker" wordmark (default; use in headers)
 *   - `icon`  — icon only (rare: tight tabs, mobile collapsed nav)
 *
 * Sizes:
 *   - `sm` — 24px icon, base text — secondary placements
 *   - `md` — 32px icon, xl text — header default
 *   - `lg` — 48px icon, 3xl text — auth pages, splash screens
 *
 * The component is a Server Component (no state, no events) so it
 * doesn't add to the client bundle. The wrapping <Link> handles
 * locale-prefixed routing via @/i18n/navigation.
 */
export function Logo({
  variant = 'full',
  size = 'md',
  href = '/',
  className,
}: {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  href?: '/' | '/dashboard';
  className?: string;
}) {
  const iconSize = { sm: 24, md: 32, lg: 48 }[size];
  const textClass = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3xl',
  }[size];

  return (
    <Link
      href={href}
      aria-label="Resumaker home"
      className={`group inline-flex items-center gap-2 ${className ?? ''}`}
    >
      <span
        className="relative inline-flex shrink-0 items-center justify-center rounded-lg transition group-hover:scale-105"
        style={{ width: iconSize, height: iconSize }}
      >
        {/*
          Inline SVG instead of <img src="/icon.svg"> so the icon
          inherits text-color tinting (useful for dark mode later)
          and avoids a separate HTTP request.
        */}
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <rect width="64" height="64" rx="14" fill="url(#logo-grad)" />
          <path
            d="M16 18h32a2 2 0 0 1 2 2v24a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V20a2 2 0 0 1 2-2z"
            fill="white"
            fillOpacity="0.95"
          />
          <rect x="20" y="24" width="14" height="2.5" rx="1.25" fill="#6d28d9" />
          <rect x="20" y="30" width="24" height="1.8" rx="0.9" fill="#94a3b8" />
          <rect x="20" y="34" width="20" height="1.8" rx="0.9" fill="#94a3b8" />
          <rect x="20" y="38" width="22" height="1.8" rx="0.9" fill="#94a3b8" />
          <circle cx="46" cy="44" r="6" fill="#10b981" stroke="white" strokeWidth="2" />
          <path
            d="M43 44l2 2 4-4"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="logo-grad" x1="0" y1="0" x2="64" y2="64">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      {variant === 'full' && (
        <span
          className={`from-brand-700 via-brand-500 to-brand-700 bg-gradient-to-r bg-[length:200%_100%] bg-clip-text font-bold tracking-tight text-transparent transition-[background-position] duration-500 group-hover:bg-right ${textClass}`}
        >
          Resumaker
        </span>
      )}
    </Link>
  );
}
