'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Copy, Trash2, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Action bar for the cover letter detail page: copy + delete.
 */
export function CoverLetterActions({
  id,
  content,
  isHebrew,
}: {
  id: string;
  content: string;
  isHebrew: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    toast.success(isHebrew ? 'הועתק' : 'Copied');
  }

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/cover-letters/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(isHebrew ? 'נמחק' : 'Deleted');
        router.push('/cover-letters');
        router.refresh();
      } else {
        toast.error(isHebrew ? 'המחיקה נכשלה' : 'Delete failed');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-shrink-0 gap-2">
      <Button variant="outline" size="sm" onClick={handleCopy}>
        <Copy className="me-1 h-4 w-4" />
        {isHebrew ? 'העתק' : 'Copy'}
      </Button>
      {confirming ? (
        <>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? (
              <Loader2 className="me-1 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="me-1 h-4 w-4" />
            )}
            {isHebrew ? 'אישור?' : 'Confirm?'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
            disabled={deleting}
          >
            {isHebrew ? 'ביטול' : 'Cancel'}
          </Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" onClick={handleDelete}>
          <Trash2 className="me-1 h-4 w-4 text-red-500" />
        </Button>
      )}
    </div>
  );
}
