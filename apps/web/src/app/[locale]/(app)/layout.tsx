import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { AppHeader } from '@/components/app-header';
import { Link } from '@/i18n/navigation';

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
    redirect('/sign-in');
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
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
