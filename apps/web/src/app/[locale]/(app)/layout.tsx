import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { AppHeader } from '@/components/app-header';
import { Link } from '@/i18n/navigation';
import { SessionGuard } from '@/components/session-guard';

/** Better Auth cookie prefix — matches `cookiePrefix` in apps/web/src/lib/auth.ts. */
const AUTH_COOKIE_PREFIX = 'resumaker.';

/**
 * Layout for all signed-in app pages. Redirects to /sign-in if no session.
 *
 * Includes a slim legal footer with links to Privacy / Terms /
 * Accessibility / Contact. Required by Israeli accessibility law
 * (חוק שוויון זכויות לאנשים עם מוגבלות) — the accessibility statement
 * must be reachable from every page, including the authenticated app
 * shell. Also satisfies the Privacy Law disclosure requirement that
 * data subjects can always find the contact for data-subject requests.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    // Orphan-session defence: a session cookie may still be present
    // even though the session row was deleted (admin grant, password
    // reset, security-event invalidation, etc). Without clearing the
    // cookie, every subsequent request loops:
    //   1. Cookie present → cookieCache returns null when re-validated
    //   2. Layout redirects to /sign-in
    //   3. But marketing routes still see the cookie and may render
    //      half-signed-in UI (header shows sign-in + sign-out together)
    // Deleting the cookies inside the redirect response carries the
    // Set-Cookie header to the browser, so the next request lands clean.
    const cookieStore = await cookies();
    for (const c of cookieStore.getAll()) {
      if (c.name.startsWith(AUTH_COOKIE_PREFIX)) {
        cookieStore.delete(c.name);
      }
    }
    redirect('/sign-in');
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      {/* Layer B: client-side watchdog that force-reloads if the
          session ever flips from truthy to null while the operator is
          on a page (e.g. their session is revoked mid-tab). Server
          layout above is the primary defence; this catches the
          edge case where SSR didn't run again. */}
      <SessionGuard />
      <AppHeader />
      <main id="main" className="text-foreground container mx-auto flex-1 px-4 py-8">
        {children}
      </main>
      <AppLegalFooter />
    </div>
  );
}

function AppLegalFooter() {
  return (
    <footer className="border-border text-muted-foreground border-t py-4 text-xs">
      <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4">
        <Link href="/privacy" className="hover:text-foreground transition">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-foreground transition">
          Terms
        </Link>
        <Link href="/legal/accessibility" className="hover:text-foreground transition">
          Accessibility
        </Link>
        <Link href="/legal/data-retention" className="hover:text-foreground transition">
          Data retention
        </Link>
        <Link href="/contact" className="hover:text-foreground transition">
          Contact
        </Link>
        <span className="text-muted-foreground/60">·</span>
        <span>© 2026 Resumaker</span>
      </div>
    </footer>
  );
}
