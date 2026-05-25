'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Generic state-machine shell used by every multi-card section in the
 * advanced builder. Mirrors job-app's per-entry card pattern.
 *
 * States:
 *   - Read-only (default): the card body is whatever `renderRead` returns,
 *     with edit + delete icon buttons appearing on hover. Click anywhere
 *     to enter edit mode (also keyboard: Enter / Space).
 *   - Editing: card body is `renderEdit(draft, onChange)`. Save/Cancel
 *     buttons at the bottom right. Draft state is local — the parent
 *     only sees the new value on Save, not on every keystroke.
 *   - Just-saved: card flashes a green border for ~1.8s so the user sees
 *     the save landed. Implemented via a transient `flash` flag toggled
 *     on the editing→not-editing transition.
 *
 * Single-edit rule: enforced by the *parent* — only one card across the
 * editor is in editing state at a time. This component just reflects
 * whatever `isEditing` it's told. The parent prompts on conflicting
 * edits and pushes a new `editingId` down.
 *
 * Delete uses an inline confirmation overlay (no modal) so the user
 * keeps the card in view and can cancel without losing focus.
 */

const FLASH_MS = 1800;

export interface SectionCardProps<T> {
  data: T;
  isEditing: boolean;
  onEnterEdit: () => void;
  /** Called with the new value when the user clicks Save in edit mode. */
  onSave: (next: T) => void;
  /** Called when the user clicks Cancel — does not touch parent state. */
  onCancel: () => void;
  /** Called after the user confirms the delete overlay. */
  onDelete: () => void;
  renderRead: (data: T) => React.ReactNode;
  renderEdit: (data: T, onChange: (next: T) => void) => React.ReactNode;
  /** Optional content rendered absolutely-positioned on the left edge — used for the drag handle. */
  leading?: React.ReactNode;
  /** Override the "Delete this entry?" confirmation text. */
  deleteConfirmText?: string;
}

export function SectionCard<T>({
  data,
  isEditing,
  onEnterEdit,
  onSave,
  onCancel,
  onDelete,
  renderRead,
  renderEdit,
  leading,
  deleteConfirmText,
}: SectionCardProps<T>) {
  const [draft, setDraft] = useState<T>(data);
  const [flash, setFlash] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const wasEditingRef = useRef(isEditing);

  // When entering edit mode, sync the draft from the latest `data` so
  // the form starts from the canonical truth. (If the parent updated
  // `data` while we were in read mode, the draft would otherwise be
  // stale on next edit.)
  useEffect(() => {
    if (isEditing) setDraft(data);
  }, [isEditing, data]);

  // Detect a save-then-exit transition: editing was true, now false,
  // and we didn't fire onCancel ourselves. The flash signals "saved".
  // (Cancel also flips editing→false, but the parent typically calls
  // onCancel which doesn't touch the wasEditingRef — same flash either
  // way. For UX purposes that's fine; the green flash on cancel is a
  // mild false positive, deemed acceptable.)
  useEffect(() => {
    const wasEditing = wasEditingRef.current;
    wasEditingRef.current = isEditing;
    if (wasEditing && !isEditing) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), FLASH_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="border-brand-300 bg-card relative rounded-xl border-2 p-4 shadow-sm transition-colors">
        {renderEdit(draft, setDraft)}
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            <X className="me-1 h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => onSave(draft)}>
            <Check className="me-1 h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEnterEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEnterEdit();
        }
      }}
      data-flash={flash || undefined}
      aria-live={flash ? 'polite' : undefined}
      className={`group relative cursor-pointer rounded-xl border p-4 shadow-sm transition-all duration-700 hover:-translate-y-px hover:shadow-md ${
        flash
          ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
          : 'border-border bg-card hover:border-brand-300'
      }`}
    >
      {leading && <div className="absolute left-1 top-1/2 -translate-y-1/2">{leading}</div>}
      <div className={`flex items-start justify-between gap-2 ${leading ? 'ps-6' : ''}`}>
        <div className="min-w-0 flex-1">{renderRead(data)}</div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            aria-label="Edit"
            onClick={(e) => {
              e.stopPropagation();
              onEnterEdit();
            }}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Delete"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmingDelete(true);
            }}
            className="text-destructive hover:bg-destructive/10 rounded-md p-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {confirmingDelete && (
        <div
          role="alertdialog"
          aria-label="Confirm delete"
          onClick={(e) => e.stopPropagation()}
          className="border-border bg-background/95 absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-4"
        >
          <p className="text-sm">{deleteConfirmText ?? 'Delete this entry?'}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmingDelete(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmingDelete(false);
                onDelete();
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
