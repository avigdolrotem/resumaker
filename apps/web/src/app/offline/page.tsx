'use client';

/**
 * /offline — shown by the service worker when the user navigates
 * to a page that has no cached version and no network.
 *
 * Client component because the "Try again" button needs an onClick
 * handler. The page still prerenders to static HTML at build time —
 * Next.js does that for client components too, then hydrates on load.
 *
 * Dependency-free by design, same as global-error.tsx and the root
 * not-found.tsx: this route lives outside the [locale] segment, so
 * there's no wrapping layout.tsx to pull in globals.css, next-intl,
 * or the shared UI components — those are only guaranteed to be
 * bundled for routes nested under [locale]/layout.tsx. Precaching a
 * page whose styling might not actually load defeats the point of an
 * offline fallback, so the "liquid glass" look here is hand-rolled
 * with inline styles / a plain <style> tag instead of Tailwind
 * utilities or <AnimatedMeshBg>/<GlassPanel>.
 */
export default function OfflinePage() {
  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background:
            'radial-gradient(circle at 20% 20%, rgba(139,92,246,0.18), transparent 55%), radial-gradient(circle at 80% 75%, rgba(168,85,247,0.14), transparent 50%), #fafafa',
          color: '#171717',
        }}
      >
        {/* Plain CSS, not styled-jsx — works with zero build-time
            dependency, matching the rest of this file. Handles dark
            mode via prefers-color-scheme since the app's ThemeProvider
            (which toggles a `.dark` class) never mounts on this route,
            and includes its own reduced-motion guard since the global
            safety net in globals.css may not reach this route either. */}
        <style>{`
          @media (prefers-color-scheme: dark) {
            body {
              background: radial-gradient(circle at 20% 20%, rgba(139,92,246,0.25), transparent 55%), radial-gradient(circle at 80% 75%, rgba(168,85,247,0.18), transparent 50%), #0a0a0a !important;
              color: #f5f5f5 !important;
            }
            .offline-card {
              background: rgba(30,27,45,0.55) !important;
              border-color: rgba(255,255,255,0.12) !important;
            }
          }
          @keyframes offline-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          .offline-retry {
            transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease;
          }
          .offline-retry:hover {
            transform: translateY(-2px) scale(1.03);
            box-shadow: 0 12px 28px rgba(126,34,206,0.35);
          }
          .offline-retry:active {
            transform: scale(0.96);
          }
          @media (prefers-reduced-motion: reduce) {
            .offline-icon { animation: none !important; }
            .offline-retry, .offline-retry:hover, .offline-retry:active { transition: none !important; transform: none !important; }
          }
        `}</style>

        <div
          className="offline-card"
          style={{
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.65)',
            borderRadius: '28px',
            padding: '3rem 2.5rem',
            maxWidth: '26rem',
            boxShadow: '0 16px 48px rgba(76,29,149,0.16)',
          }}
        >
          <div
            className="offline-icon"
            style={{ fontSize: '3.5rem', animation: 'offline-float 3s ease-in-out infinite' }}
            role="img"
            aria-label="לא מקוון"
          >
            📡
          </div>
          <h1 style={{ marginTop: '1rem', fontSize: '1.5rem', fontWeight: 700 }}>
            אין חיבור לאינטרנט
          </h1>
          <p style={{ marginTop: '0.75rem', maxWidth: '22rem', opacity: 0.75 }}>
            נראה שאתה לא מחובר. בדוק את חיבור האינטרנט שלך ונסה שוב.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="offline-retry"
            style={{
              marginTop: '1.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '9999px',
              border: 'none',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff',
              padding: '0.65rem 2rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            נסה שוב
          </button>
        </div>
      </body>
    </html>
  );
}
