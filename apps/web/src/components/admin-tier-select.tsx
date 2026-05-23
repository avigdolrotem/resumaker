'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type Tier = 'free' | 'plus' | 'pro';

/**
 * Inline tier selector for the admin user-detail page.
 *
 * Lets the operator grant pro/premium without going through Stripe.
 * Useful for friends/family and abuse remediation. Sets `grantedBy`
 * server-side so it can be audited and excluded from Stripe sync.
 */
export function AdminTierSelect({ userId, currentTier }: { userId: string; currentTier: Tier }) {
  const [tier, setTier] = useState<Tier>(currentTier);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function handleChange(next: Tier) {
    if (next === tier) return;
    const previous = tier;
    setTier(next);
    try {
      const res = await fetch(`/api/admin/users/${userId}/tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: next,
          notes: `Admin grant via console: ${previous} → ${next}`,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setTier(previous);
        toast.error(data.error ?? 'Tier change failed');
        return;
      }
      toast.success(`Tier changed to ${next}`);
      startTransition(() => router.refresh());
    } catch (err) {
      setTier(previous);
      toast.error((err as Error).message);
    }
  }

  const colorMap: Record<Tier, string> = {
    free: 'bg-neutral-100 text-neutral-700',
    plus: 'bg-amber-100 text-amber-800',
    pro: 'bg-violet-100 text-violet-800',
  };

  return (
    <div className="inline-flex items-center gap-1">
      <select
        value={tier}
        onChange={(e) => void handleChange(e.target.value as Tier)}
        disabled={pending}
        className={`rounded px-2 py-0.5 text-xs font-medium ${colorMap[tier]} focus:ring-brand-500 cursor-pointer border-0 focus:outline-none focus:ring-2`}
        aria-label="User tier"
      >
        <option value="free">free</option>
        <option value="plus">plus</option>
        <option value="pro">pro</option>
      </select>
      {pending && <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />}
    </div>
  );
}
