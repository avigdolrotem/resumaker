import { requireAdminPage } from '@/lib/auth-guards';
import { db, schema } from '@/db';
import { desc, and, gte, lte, eq } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
        className="hover:text-brand-600 text-muted-foreground ease-snappy hover:bg-accent/60 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-all duration-200"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        Back to admin
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground text-sm">Search and filter system events</p>
      </div>

      {/* Filter toolbar — full glass: page-level chrome, not a scan surface. */}
      <div className="glass rounded-2xl p-6">
        <form className="grid gap-3 sm:grid-cols-4" method="GET">
          <Input name="from" type="date" defaultValue={sp.from ?? ''} placeholder="From" />
          <Input name="to" type="date" defaultValue={sp.to ?? ''} placeholder="To" />
          <Input name="event" defaultValue={sp.event ?? ''} placeholder="Event type" />
          <Input
            name="userId"
            defaultValue={sp.userId ?? ''}
            placeholder="User ID"
            className="font-mono"
          />
          <Button type="submit" className="col-span-full sm:col-span-1">
            Search
          </Button>
        </form>
      </div>

      {/* Results table — glass-subtle, no hover-lift: dense scan surface
          stays flat + fast per the admin design note. */}
      <div className="glass-subtle overflow-hidden rounded-2xl">
        <div className="overflow-x-auto p-6">
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
                <tr key={row.id} className="hover:bg-accent/40 transition-colors">
                  <td
                    className="text-muted-foreground whitespace-nowrap py-2 ps-1 text-xs"
                    dir="ltr"
                  >
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2">
                    <span className="bg-muted rounded-full px-2 py-0.5 font-mono text-xs">
                      {row.event}
                    </span>
                  </td>
                  <td className="text-muted-foreground py-2 font-mono text-xs" dir="ltr">
                    {row.userId ? row.userId.slice(0, 12) + '…' : '—'}
                  </td>
                  <td className="text-muted-foreground py-2 text-xs">
                    {row.metadata ? (
                      <details>
                        <summary className="hover:text-foreground cursor-pointer">view</summary>
                        <pre className="bg-muted max-w-xs overflow-x-auto rounded-xl p-1 text-[10px]">
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

          {rows.length === 0 && (
            <p className="text-muted-foreground mt-4 text-center text-sm">No results</p>
          )}
        </div>

        <div className="border-border/60 text-muted-foreground flex items-center justify-between border-t px-6 py-3 text-sm">
          {page > 1 ? (
            <Button variant="ghost" size="sm" asChild>
              <Link
                href={`?page=${page - 1}${sp.event ? `&event=${sp.event}` : ''}${sp.userId ? `&userId=${sp.userId}` : ''}`}
              >
                Previous
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span>Page {page}</span>
          {rows.length === pageSize ? (
            <Button variant="ghost" size="sm" asChild>
              <Link
                href={`?page=${page + 1}${sp.event ? `&event=${sp.event}` : ''}${sp.userId ? `&userId=${sp.userId}` : ''}`}
              >
                Next
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  );
}
