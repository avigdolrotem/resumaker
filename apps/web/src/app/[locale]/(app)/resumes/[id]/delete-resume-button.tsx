'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export function DeleteResumeButton({
  resumeId,
  isHebrew,
}: {
  resumeId: string;
  isHebrew: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/resumes/${resumeId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? (isHebrew ? 'מחיקה נכשלה' : 'Delete failed'));
        return;
      }
      toast.success(isHebrew ? 'נמחק' : 'Deleted');
      router.push('/resumes');
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-xs">{isHebrew ? 'למחוק?' : 'Delete?'}</span>
        <Button
          variant="destructive"
          size="sm"
          disabled={deleting}
          onClick={() => void handleDelete()}
        >
          {deleting ? '…' : isHebrew ? 'מחק' : 'Delete'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          {isHebrew ? 'ביטול' : 'Cancel'}
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
      <Trash2 className="me-1.5 h-3.5 w-3.5" />
      {isHebrew ? 'מחק' : 'Delete'}
    </Button>
  );
}
