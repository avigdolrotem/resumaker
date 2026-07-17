'use client';

import { useMemo, useState } from 'react';
import { Search, X, ExternalLink } from 'lucide-react';
import { AdminRoleSelect } from './admin-role-select';
import { Input } from './ui/input';
import { Link } from '@/i18n/navigation';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified: Date | null | boolean;
  createdAt: Date;
  deletedAt: Date | null;
}

/**
 * Client-side filterable admin users table.
 * Server renders the initial 50; client filters via search + role.
 */
export function AdminUserSearch({ users }: { users: AdminUser[] }) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<
    'all' | 'user' | 'admin' | 'support' | 'suspended' | 'hr'
  >('all');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.name ?? '').toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    });
  }, [users, query, roleFilter]);

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email, name, or ID…"
            className="pe-9 ps-9"
            dir="ltr"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground absolute end-3 top-1/2 -translate-y-1/2"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
          className="border-input bg-background/60 text-foreground ease-smooth focus-visible:border-brand-400/60 focus-visible:bg-background focus-visible:ring-brand-500/18 h-10 rounded-xl border px-3 text-sm shadow-sm backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-4"
        >
          <option value="all">All roles</option>
          <option value="user">user</option>
          <option value="admin">admin</option>
          <option value="support">support</option>
          <option value="suspended">suspended</option>
          <option value="hr">hr</option>
        </select>
        <span className="text-muted-foreground text-sm">
          {filtered.length} / {users.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Filtered admin user list</caption>
          <thead className="text-muted-foreground text-start text-xs uppercase">
            <tr className="border-border border-b">
              <th scope="col" className="pb-2 ps-1 font-medium">
                Email
              </th>
              <th scope="col" className="pb-2 font-medium">
                Name
              </th>
              <th scope="col" className="pb-2 font-medium">
                Role
              </th>
              <th scope="col" className="pb-2 font-medium">
                Verified
              </th>
              <th scope="col" className="pb-2 font-medium">
                Joined
              </th>
              <th scope="col" className="pb-2 font-medium">
                {/* View link header — left blank intentionally to save horizontal space */}
                <span className="sr-only">View</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted-foreground py-8 text-center text-sm">
                  No users match the filters
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className={u.deletedAt ? 'opacity-50' : ''}>
                  <td className="py-2 ps-1 font-mono text-xs" dir="ltr">
                    {u.email}
                  </td>
                  <td className="py-2">{u.name ?? '—'}</td>
                  <td className="py-2">
                    <AdminRoleSelect userId={u.id} currentRole={u.role} />
                  </td>
                  <td className="py-2 text-xs">
                    {u.emailVerified ? (
                      <span className="text-emerald-600">✓</span>
                    ) : (
                      <span className="text-amber-600">○</span>
                    )}
                  </td>
                  <td className="text-muted-foreground py-2 text-xs">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 pe-1 text-end">
                    {/* The user-detail page is reachable via this link.
                        Without this, the only way there was typing the
                        URL manually — the page existed but was orphaned. */}
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors"
                      aria-label={`View user ${u.email}`}
                    >
                      View
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
