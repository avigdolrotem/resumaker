/**
 * Fallback for routes outside the [locale] segment.
 * Should rarely fire because middleware redirects to a locale.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" dir="ltr">
      <body>
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '4rem', fontWeight: 700 }}>404</h1>
          <p style={{ marginTop: '1rem', fontSize: '1.25rem' }}>Page not found</p>
          <a href="/he" style={{ marginTop: '2rem' }}>Go home</a>
        </main>
      </body>
    </html>
  );
}
