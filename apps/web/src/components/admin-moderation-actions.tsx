'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

/** Approve/reject pair for one row of /admin/moderation — same shape for both the pending-jobs and trust-requests tables, just a different endpoint. */
export function ModerationActions({
  endpoint,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
}: {
  endpoint: string;
  approveLabel?: string;
  rejectLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  async function decide(decision: 'approve' | 'reject' | 'deny') {
    setBusy(decision === 'deny' ? 'reject' : decision);
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Action failed');
        return;
      }
      toast.success(decision === 'approve' ? 'Approved' : 'Rejected');
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={busy !== null}
        onClick={() => decide('approve')}
      >
        {busy === 'approve' ? '…' : approveLabel}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={busy !== null}
        onClick={() => decide(endpoint.includes('trust-requests') ? 'deny' : 'reject')}
      >
        {busy === 'reject' ? '…' : rejectLabel}
      </Button>
    </div>
  );
}
