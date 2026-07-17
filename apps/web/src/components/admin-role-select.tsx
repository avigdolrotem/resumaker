'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type Role = 'user' | 'admin' | 'support' | 'suspended' | 'hr';

/**
 * Inline role selector for the admin users table.
 * Server validates that caller is admin before applying changes.
 */
export function AdminRoleSelect({ userId, currentRole }: { userId: string; currentRole: string }) {
  const [role, setRole] = useState<Role>(currentRole as Role);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function handleChange(next: Role) {
    if (next === role) return;
    const previous = role;
    setRole(next);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRole(previous);
        toast.error(data.error ?? 'Role change failed');
        return;
      }
      toast.success(`Role changed to ${next}`);
      startTransition(() => router.refresh());
    } catch (err) {
      setRole(previous);
      toast.error((err as Error).message);
    }
  }

  const colorMap: Record<Role, string> = {
    admin: 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200',
    support: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200',
    user: 'bg-muted text-foreground',
    suspended: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
    hr: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  };

  return (
    <div className="inline-flex items-center gap-1">
      <select
        value={role}
        onChange={(e) => void handleChange(e.target.value as Role)}
        disabled={pending}
        className={`ease-smooth rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-200 ${colorMap[role]} focus:ring-brand-500 cursor-pointer border-0 focus:outline-none focus:ring-2`}
      >
        <option value="user">user</option>
        <option value="admin">admin</option>
        <option value="support">support</option>
        <option value="suspended">suspended</option>
        <option value="hr">hr (reserved)</option>
      </select>
      {pending && <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />}
    </div>
  );
}
