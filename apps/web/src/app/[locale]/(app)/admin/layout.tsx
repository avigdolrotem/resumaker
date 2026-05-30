import type { ReactNode } from 'react';
import { requireAdminPage } from '@/lib/auth-guards';

/**
 * Admin-only layout. Defense in depth: every admin Server Component
 * also calls `requireAdminPage()` directly so a refactor of this layout
 * (or a new admin route that forgets to nest under it) doesn't quietly
 * leak data. Client-component admin pages (broadcast/coupons/maintenance)
 * can't call the server guard, so they rely on this layout for page-access
 * gating + their data comes only from `requireAdmin`-guarded API routes.
 *
 * `requireAdminPage()` 404s for non-admins so URLs don't reveal which
 * paths are admin-gated.
 *
 * `force-dynamic`: never prerender/cache any admin route. The guard reads
 * the session cookie + the fresh DB role on EVERY request, so a stale
 * prerender or shared CDN/Full-Route-Cache entry can never serve an admin
 * shell (or a 200) to a non-admin. (Observed under `next dev`: without this,
 * the prerendered shell returned 200 to a non-admin instead of 404.)
 */
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();
  return <>{children}</>;
}
