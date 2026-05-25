import { requireAdminPage } from '@/lib/auth-guards';
import { db, schema } from '@/db';
import { desc, and, gte, lte, eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';

interface Props {
  searchParams: Promise<{
    from?: string;
    to?: string;
    event?: string;
    userId?: string;
    page?: string;
  }>;
}

export default async function AdminAuditPage({ searchParams }: Props) {
  await requireAdminPage();

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1'));
  const pageSize = 50;

  const conditions = [];
  if (sp.from) conditions.push(gte(schema.auditLog.createdAt, new Date(sp.from)));
  if (sp.to) conditions.push(lte(schema.auditLog.createdAt, new Date(sp.to)));
  if (sp.event) conditions.push(eq(schema.auditLog.event, sp.event));
  if (sp.userId) conditions.push(eq(schema.auditLog.userId, sp.userId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.query.auditLog.findMany({
    where,
    orderBy: [desc(schema.auditLog.createdAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="hover:text-brand-600 text-muted-foreground inline-flex items-center gap-1 text-sm transition"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        Back to admin
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>Search and filter system events</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="mb-6 grid gap-3 sm:grid-cols-4" method="GET">
            <input
              name="from"
              type="date"
              defaultValue={sp.from ?? ''}
              placeholder="From"
              className="border-border rounded-md border px-3 py-2 text-sm"
            />
            <input
              name="to"
              type="date"
              defaultValue={sp.to ?? ''}
              placeholder="To"
              className="border-border rounded-md border px-3 py-2 text-sm"
            />
            <input
              name="event"
              defaultValue={sp.event ?? ''}
              placeholder="Event type"
              className="border-border rounded-md border px-3 py-2 text-sm"
            />
            <input
              name="userId"
              defaultValue={sp.userId ?? ''}
              placeholder="User ID"
              className="border-border rounded-md border px-3 py-2 font-mono text-sm"
            />
            <button
              type="submit"
              className="bg-brand-600 col-span-full rounded-md px-4 py-2 text-sm font-medium text-white sm:col-span-1"
            >
              Search
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Audit log events</caption>
              <thead className="text-muted-foreground text-start text-xs uppercase">
                <tr className="border-border border-b">
                  <th scope="col" className="pb-2 ps-1 font-medium">
                    When
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Event
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    User ID
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Metadata
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td
                      className="text-muted-foreground whitespace-nowrap py-2 ps-1 text-xs"
                      dir="ltr"
                    >
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2">
                      <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">
                        {row.event}
                      </span>
                    </td>
                    <td className="text-muted-foreground py-2 font-mono text-xs" dir="ltr">
                      {row.userId ? row.userId.slice(0, 12) + '…' : '—'}
                    </td>
                    <td className="text-muted-foreground py-2 text-xs">
                      {row.metadata ? (
                        <details>
                          <summary className="cursor-pointer">view</summary>
                          <pre className="bg-muted max-w-xs overflow-x-auto rounded p-1 text-[10px]">
                            {JSON.stringify(row.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length === 0 && (
            <p className="text-muted-foreground mt-4 text-center text-sm">No results</p>
          )}

          <div className="text-muted-foreground mt-4 flex justify-between text-sm">
            {page > 1 && (
              <Link
                href={`?page=${page - 1}${sp.event ? `&event=${sp.event}` : ''}${sp.userId ? `&userId=${sp.userId}` : ''}`}
              >
                Previous
              </Link>
            )}
            <span>Page {page}</span>
            {rows.length === pageSize && (
              <Link
                href={`?page=${page + 1}${sp.event ? `&event=${sp.event}` : ''}${sp.userId ? `&userId=${sp.userId}` : ''}`}
              >
                Next
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
