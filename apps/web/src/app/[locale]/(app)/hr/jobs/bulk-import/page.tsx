import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth-guards';
import { HrBulkImportForm } from '@/components/hr/hr-bulk-import-form';

/**
 * /hr/jobs/bulk-import — same role in (hr, admin) gate as /hr/jobs and
 * /hr/jobs/new. See the comment on new/page.tsx for why this needed a
 * server-side guard of its own rather than relying solely on the API
 * route's check.
 */
export default async function BulkImportPage() {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) {
    redirect('/sign-in');
  }
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') {
    redirect('/dashboard');
  }

  return <HrBulkImportForm />;
}
