import type { ReactNode } from 'react';
import { requireAdminPage } from '@/lib/auth-guards';

/**
 * Admin-only layout. Defense in depth: every admin Server Component
 * also calls `requireAdminPage()` directly so a refactor of this layout
 * (or a new admin route that forgets to nest under it) doesn't quietly
 * leak data.
 *
 * `requireAdminPage()` 404s for non-admins so URLs don't reveal which
 * paths are admin-gated.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();
  return <>{children}</>;
}
