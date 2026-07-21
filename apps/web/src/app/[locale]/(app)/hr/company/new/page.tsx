import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth-guards';
import { HrCreateCompanyForm } from '@/components/hr/hr-create-company-form';

/**
 * /hr/company/new — HR users create their first (or another) company.
 *
 * A static "new" segment sits ahead of the sibling `[id]` dynamic route
 * (Next.js resolves static segments before dynamic ones), which matters
 * here specifically: this route previously didn't exist at all, so
 * "/hr/company/new" fell through to `company/[id]/page.tsx` with
 * id="new", which fetched a company that doesn't exist and rendered
 * "Company not found." — the only "Create company" button in the app
 * led to a dead end, and POST /api/hr/companies had no caller anywhere
 * in the UI. Same guard shape as /hr/jobs/new.
 */
export default async function HrCreateCompanyPage() {
  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) {
    redirect('/sign-in');
  }
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') {
    redirect('/dashboard');
  }

  return <HrCreateCompanyForm />;
}
