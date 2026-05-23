import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { AppHeader } from '@/components/app-header';

/**
 * Layout for all signed-in app pages. Redirects to /sign-in if no session.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/sign-in');
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <AppHeader />
      <main id="main" className="container mx-auto flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
