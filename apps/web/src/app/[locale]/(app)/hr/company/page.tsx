import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { db, schema } from '@/db';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireActiveUser } from '@/lib/auth-guards';
import { NextResponse } from 'next/server';

export default async function HrCompanyListPage({
  params,
}: {
  params: Promise<{ locale: 'he' | 'en' }>;
}) {
  const { locale } = await params;

  const guard = await requireActiveUser(await headers());
  if (guard instanceof NextResponse) redirect('/sign-in');
  if (guard.user.role !== 'hr' && guard.user.role !== 'admin') redirect('/dashboard');

  const memberships = await db.query.companyMembers.findMany({
    where: eq(schema.companyMembers.userId, guard.user.id),
    with: { company: true },
  });

  const isHe = locale === 'he';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{isHe ? 'החברות שלי' : 'My companies'}</h1>
          <p className="mt-1 text-neutral-600">
            {isHe ? 'נהל את פרופיל החברה וצוות הגיוס' : 'Manage your company profile and recruitment team'}
          </p>
        </div>
        <Button asChild>
          <Link href="/hr/company/new">
            <Plus className="me-2 h-4 w-4" />
            {isHe ? 'צור חברה' : 'Create company'}
          </Link>
        </Button>
      </div>

      {memberships.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-neutral-500">
            {isHe ? 'אין חברות עדיין. לחץ "צור חברה" כדי להתחיל.' : 'No companies yet. Click "Create company" to get started.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {memberships.map((m) => (
            <Card key={m.companyId}>
              <CardContent className="flex items-center justify-between pt-5">
                <div>
                  <h3 className="font-semibold">{m.company.name}</h3>
                  <p className="text-sm text-neutral-500">
                    {isHe ? 'תפקיד: ' : 'Role: '}
                    {m.role}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/hr/company/${m.companyId}`}>
                    {isHe ? 'נהל' : 'Manage'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
