'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';

interface Flags {
  jobHuntBeta?: boolean | undefined;
  trustedSharer?: boolean | undefined;
}

/**
 * Per-user feature-flag toggle for admin. Exposes:
 * `jobHuntBeta` — legacy, now inert (the whole job-hunt surface is free
 * for everyone — see beta-gate.ts); kept as a working toggle rather than
 * removed since the flag itself is still read there.
 * `trustedSharer` — manual job imports from this user publish
 * immediately instead of landing in the /admin/moderation queue (see
 * lib/content-trust.ts). Same effect as approving a request at
 * /admin/moderation, for a user who hasn't filed one.
 *
 * Persists via PATCH /api/admin/users/[id]/flags. Optimistic update with
 * snap-back on error.
 */
export function AdminFeatureFlags({ userId, initial }: { userId: string; initial: Flags }) {
  const [flags, setFlags] = useState<Flags>(initial ?? {});
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function toggle(key: keyof Flags) {
    const next = !flags[key];
    setFlags((prev) => ({ ...prev, [key]: next })); // optimistic
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/flags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Update failed');
        setFlags((prev) => ({ ...prev, [key]: !next })); // revert
        return;
      }
      toast.success(`${key} = ${next ? 'on' : 'off'}`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setFlags((prev) => ({ ...prev, [key]: !next }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">Job-hunt beta</p>
          <p className="text-muted-foreground text-xs">
            Unlocks /jobs + /applications + AI fit-scoring for this user.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(flags.jobHuntBeta)}
          disabled={busy}
          onClick={() => toggle('jobHuntBeta')}
          className={`ease-smooth relative inline-flex h-6 w-11 items-center rounded-full shadow-inner transition-colors duration-200 disabled:opacity-50 ${
            flags.jobHuntBeta ? 'bg-brand-600' : 'bg-muted'
          }`}
        >
          <span
            className={`ease-snappy inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
              flags.jobHuntBeta ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">Trusted sharer</p>
          <p className="text-muted-foreground text-xs">
            Manual job imports from this user publish immediately instead of queuing at
            /admin/moderation.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(flags.trustedSharer)}
          disabled={busy}
          onClick={() => toggle('trustedSharer')}
          className={`ease-smooth relative inline-flex h-6 w-11 items-center rounded-full shadow-inner transition-colors duration-200 disabled:opacity-50 ${
            flags.trustedSharer ? 'bg-brand-600' : 'bg-muted'
          }`}
        >
          <span
            className={`ease-snappy inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
              flags.trustedSharer ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
