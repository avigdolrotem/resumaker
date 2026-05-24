'use client';

/**
 * /offline — shown by the service worker when the user navigates
 * to a page that has no cached version and no network.
 *
 * Client component because the "Try again" button needs an onClick
 * handler. The page still prerenders to static HTML at build time —
 * Next.js does that for client components too, then hydrates on load.
 */
export default function OfflinePage() {
  return (
    <html lang="he" dir="rtl">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 p-8 text-center font-sans">
        <div className="text-6xl">offline</div>
        <h1 className="text-2xl font-bold text-neutral-800">אין חיבור לאינטרנט</h1>
        <p className="max-w-sm text-neutral-600">
          נראה שאתה לא מחובר. בדוק את חיבור האינטרנט שלך ונסה שוב.
        </p>
        <p className="text-sm text-neutral-400">
          No internet connection. Please check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-md bg-purple-700 px-6 py-2 text-sm font-medium text-white hover:bg-purple-800"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
