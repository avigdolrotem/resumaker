'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

interface PanelPosition {
  top: number;
  left?: number;
  right?: number;
}

/**
 * Compact version history widget — fetches versions for a resume and
 * lets the user restore one. Designed for the builder/preview pane.
 *
 * The panel renders through a portal into document.body rather than as
 * a plain `absolute` child of the trigger. This lives inside the
 * builder's action-bar Card, which has both `overflow-hidden` (clips
 * anything positioned outside the card's own box) and `glass`
 * (backdrop-filter creates a new stacking context, trapping any
 * z-index in here below whatever the next sibling Card happens to
 * paint) — together those meant the panel rendered fully behind the
 * next card down the page, at any z-index. Portaling escapes both;
 * position is computed from the trigger's real bounding rect instead
 * of relying on CSS positioning context.
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
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || versions) return;
    setLoading(true);
    fetch(`/api/resumes/${resumeId}/versions`)
      .then((r) => r.json())
      .then((data) => setVersions(data.versions ?? []))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [open, resumeId, versions]);

  // Keep the portaled panel's position glued to the trigger button
  // while open — it's no longer a CSS-positioned child of it.
  useEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      // `end-0` equivalent: align to the trigger's trailing edge,
      // which is the right edge in LTR and the left edge in RTL.
      setPosition(
        isHebrew
          ? { top: rect.bottom + 8, left: rect.left }
          : { top: rect.bottom + 8, right: window.innerWidth - rect.right },
      );
    }
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, isHebrew]);

  // Close on outside click or Escape — there was no such handling
  // before (portaling out of the trigger's DOM subtree makes this more
  // noticeable, since a click that used to land "outside" the card but
  // still visually near the panel now unambiguously reads as outside).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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
    <div ref={triggerRef} className="inline-block">
      <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>
        <History className="me-1 h-4 w-4" />
        {isHebrew ? 'היסטוריה' : 'History'}
      </Button>

      {open &&
        position &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              right: position.right,
            }}
            className="border-border bg-card z-50 w-80 rounded-lg border shadow-xl"
          >
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
          </div>,
          document.body,
        )}
    </div>
  );
}
