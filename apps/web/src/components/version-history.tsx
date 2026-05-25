'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { History, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

interface Version {
  id: string;
  versionNumber: number;
  title: string;
  label: string | null;
  createdAt: string;
}

/**
 * Compact version history widget — fetches versions for a resume and
 * lets the user restore one. Designed for the builder/preview pane.
 */
export function VersionHistory({
  resumeId,
  isHebrew = false,
}: {
  resumeId: string;
  isHebrew?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoringNumber, setRestoringNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!open || versions) return;
    setLoading(true);
    fetch(`/api/resumes/${resumeId}/versions`)
      .then((r) => r.json())
      .then((data) => setVersions(data.versions ?? []))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [open, resumeId, versions]);

  async function restore(versionNumber: number) {
    if (
      !confirm(
        isHebrew
          ? 'לשחזר גרסה זו?'
          : 'Restore this version? Your current edits will be saved as a new version first.',
      )
    ) {
      return;
    }
    setRestoringNumber(versionNumber);
    try {
      const res = await fetch(`/api/resumes/${resumeId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Restore failed');
        return;
      }
      toast.success(
        isHebrew ? `שוחזרה גרסה ${versionNumber}` : `Restored version ${versionNumber}`,
      );
      // Refetch versions so the pre-restore-snapshot shows up
      setVersions(null);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRestoringNumber(null);
    }
  }

  return (
    <div className="relative inline-block">
      <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>
        <History className="me-1 h-4 w-4" />
        {isHebrew ? 'היסטוריה' : 'History'}
      </Button>

      {open && (
        <div className="border-border bg-card absolute end-0 z-20 mt-2 w-80 rounded-lg border shadow-xl">
          <div className="border-border border-b p-3">
            <h3 className="text-sm font-semibold">
              {isHebrew ? 'גרסאות קודמות' : 'Previous versions'}
            </h3>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="text-muted-foreground flex items-center justify-center p-6 text-sm">
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {isHebrew ? 'טוען…' : 'Loading…'}
              </div>
            ) : !versions || versions.length === 0 ? (
              <p className="text-muted-foreground p-6 text-center text-sm">
                {isHebrew
                  ? 'אין גרסאות קודמות עדיין. כל עריכה תשמור גרסה.'
                  : 'No previous versions yet. Each edit saves one.'}
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-mono text-xs">
                          v{v.versionNumber}
                        </span>
                        {v.label && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                            {v.label}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs" dir="ltr">
                        {new Date(v.createdAt).toLocaleString(isHebrew ? 'he-IL' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void restore(v.versionNumber)}
                      disabled={restoringNumber !== null}
                    >
                      {restoringNumber === v.versionNumber ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
