'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { AdminRoleSelect } from './admin-role-select';
import { Input } from './ui/input';

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
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin' | 'support' | 'suspended'>(
    'all',
  );

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
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
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
              className="absolute end-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
          className="focus:ring-brand-500 h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:outline-none focus:ring-2"
        >
          <option value="all">All roles</option>
          <option value="user">user</option>
          <option value="admin">admin</option>
          <option value="support">support</option>
          <option value="suspended">suspended</option>
        </select>
        <span className="text-sm text-neutral-500">
          {filtered.length} / {users.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Filtered admin user list</caption>
          <thead className="text-start text-xs uppercase text-neutral-500">
            <tr className="border-b border-neutral-200">
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
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-neutral-500">
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
                  <td className="py-2 text-xs text-neutral-500">
                    {new Date(u.createdAt).toLocaleDateString()}
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
