'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** "Close" action for a card in /hr/jobs's own-postings list — see the route's own comment for why this is a status update, not a delete. */
export function HrJobCloseButton({ jobId, isHebrew }: { jobId: string; isHebrew: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  async function close() {
    const res = await fetch(`/api/hr/jobs/${jobId}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error(isHebrew ? 'הפעולה נכשלה' : 'Action failed');
      return;
    }
    toast.success(isHebrew ? 'המשרה נסגרה' : 'Job closed');
    startTransition(() => router.refresh());
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">
          {isHebrew ? 'לסגור את המשרה?' : 'Close this listing?'}
        </span>
        <Button size="sm" variant="destructive" disabled={isPending} onClick={close}>
          {isHebrew ? 'סגור' : 'Close'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          {isHebrew ? 'ביטול' : 'Cancel'}
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
      <X className="me-1 h-3.5 w-3.5" />
      {isHebrew ? 'סגור משרה' : 'Close listing'}
    </Button>
  );
}
