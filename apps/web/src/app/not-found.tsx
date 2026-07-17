/**
 * Fallback for routes outside the [locale] segment. The doc comment
 * this replaced claimed this "should rarely fire because middleware
 * redirects to a locale" — that's not what happens in practice: an
 * unmatched path *under* a resolved locale (e.g. /en/some-typo) still
 * bubbles past [locale]/not-found.tsx to this root boundary, so any
 * mistyped/dead link on the live site lands here. Verified by hitting
 * it directly during the redesign rollout.
 *
 * Dependency-free by design, same as offline/page.tsx and
 * global-error.tsx: this route lives outside the [locale] segment, so
 * there's no wrapping layout.tsx to pull in globals.css, next-intl, or
 * the shared UI components — those are only guaranteed to be bundled
 * for routes nested under [locale]/layout.tsx. Hence inline styles /
 * a plain <style> tag instead of Tailwind utilities or
 * <AnimatedMeshBg>/<GlassPanel>.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" dir="ltr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background:
            'radial-gradient(circle at 20% 20%, rgba(139,92,246,0.18), transparent 55%), radial-gradient(circle at 80% 75%, rgba(168,85,247,0.14), transparent 50%), #fafafa',
          color: '#171717',
        }}
      >
        {/* Plain CSS, not styled-jsx — zero build-time dependency.
            Handles dark mode via prefers-color-scheme (the app's
            ThemeProvider never mounts on this route) and its own
            reduced-motion guard (globals.css's safety net may not
            reach this route either). */}
        <style>{`
          @media (prefers-color-scheme: dark) {
            body {
              background: radial-gradient(circle at 20% 20%, rgba(139,92,246,0.25), transparent 55%), radial-gradient(circle at 80% 75%, rgba(168,85,247,0.18), transparent 50%), #0a0a0a !important;
              color: #f5f5f5 !important;
            }
            .notfound-card {
              background: rgba(30,27,45,0.55) !important;
              border-color: rgba(255,255,255,0.12) !important;
            }
          }
          .notfound-cta {
            transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease;
          }
          .notfound-cta:hover {
            transform: translateY(-2px) scale(1.03);
            box-shadow: 0 12px 28px rgba(126,34,206,0.35);
          }
          .notfound-cta:active {
            transform: scale(0.96);
          }
          @media (prefers-reduced-motion: reduce) {
            .notfound-cta, .notfound-cta:hover, .notfound-cta:active { transition: none !important; transform: none !important; }
          }
        `}</style>

        <div
          className="notfound-card"
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
          <h1
            style={{
              fontSize: '4.5rem',
              fontWeight: 800,
              margin: 0,
              backgroundImage: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            404
          </h1>
          <p style={{ marginTop: '0.75rem', fontSize: '1.15rem', opacity: 0.8 }}>Page not found</p>
          <a
            href="/he"
            className="notfound-cta"
            style={{
              marginTop: '1.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff',
              padding: '0.65rem 2rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
