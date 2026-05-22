import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';

/**
 * Admin-only layout. 404 (not 403) if the user is not admin —
 * we don't reveal that an admin path even exists to non-admins.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: { role: true },
  });

  if (!user || user.role !== 'admin') {
    // Pretend the page doesn't exist
    redirect('/dashboard');
  }

  return <>{children}</>;
}
