'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import {
  Search,
  X,
  ArrowRight,
  FileText,
  Plus,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Download,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  navigateWithViewTransition,
  useSignalViewTransitionReady,
} from '@/lib/hooks/use-view-transition-nav';

interface ResumeRow {
  id: string;
  title: string;
  locale: string;
  industry: string | null;
  updatedAt: Date | string;
  /** Latest ATS score for this resume, if it's ever been scored. */
  atsScore?: number | null;
}

/** Same 4-tier thresholds as AtsScoreCard, condensed to a badge's worth of styling. */
function atsScoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700';
  if (score >= 60) return 'bg-indigo-50 text-indigo-700';
  if (score >= 40) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

/**
 * Filterable resume grid for the dashboard.
 *
 * Each card surfaces inline actions (edit, duplicate, delete, download PDF)
 * via a hover-revealed kebab menu. Free-tier users hitting the 2-resume cap
 * had no way to delete from the UI before this — they had to call DELETE
 * /api/resumes/[id] directly. That's a real launch blocker; this fixes it.
 *
 * Delete uses an inline two-stage confirm (clicking Delete swaps the row to
 * a "Confirm? [Yes] [Cancel]" state) instead of a modal. Lighter, no extra
 * dependency, and accessible: keyboard escape cancels.
 */
export function ResumeGrid({ resumes, isHebrew }: { resumes: ResumeRow[]; isHebrew: boolean }) {
  const t = useTranslations('dashboard.actions');
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Local optimistic copy so a delete removes the tile immediately even if
  // the user's network is slow. Reconciles with server on router.refresh().
  const [localList, setLocalList] = useState(resumes);

  // The grid's own data is already resolved by the time this client
  // component mounts (passed in as a prop from the server-rendered
  // dashboard page) — so "ready" is immediate. This only matters when
  // the user navigated *back* here from the builder via
  // navigateWithViewTransition; it's a harmless no-op on a fresh visit.
  useSignalViewTransitionReady(true);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return localList;
    return localList.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.industry ?? '').toLowerCase().includes(q) ||
        r.locale.toLowerCase().includes(q),
    );
  }, [localList, query]);

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/resumes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? (isHebrew ? 'מחיקה נכשלה' : 'Delete failed'));
        return;
      }
      // Optimistic remove + soft-refresh to update tier counters elsewhere.
      setLocalList((prev) => prev.filter((r) => r.id !== id));
      toast.success(isHebrew ? 'נמחק' : 'Deleted');
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
      setConfirmingDelete(null);
    }
  }

  async function handleDuplicate(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/resumes/${id}/duplicate`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? (isHebrew ? 'שכפול נכשל' : 'Duplicate failed'));
        return;
      }
      toast.success(isHebrew ? 'שוכפל' : 'Duplicated');
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  // Empty-state check uses `localList` (the optimistic copy) not the
  // original `resumes` prop. Without this, deleting the last resume
  // would keep showing the grid until `router.refresh()` lands —
  // a confusing flash for the user.
  if (localList.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <div className="bg-brand-50 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <FileText className="text-brand-600 h-8 w-8" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">
            {isHebrew ? 'עוד אין לך קורות חיים' : 'No resumes yet'}
          </h3>
          <p className="text-muted-foreground mb-6 text-sm">
            {isHebrew ? 'בנה את הראשונים תוך דקות' : 'Build your first in minutes'}
          </p>
          <Button asChild>
            <Link href="/builder">
              <Plus className="me-2 h-4 w-4" />
              {isHebrew ? 'קורות חיים חדשים' : 'New resume'}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {resumes.length >= 4 && (
        <div className="relative max-w-md">
          <Search className="text-muted-foreground absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isHebrew ? 'חיפוש לפי כותרת, תחום…' : 'Search by title, industry…'}
            className="pe-9 ps-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground absolute end-3 top-1/2 -translate-y-1/2"
              aria-label={isHebrew ? 'נקה' : 'Clear'}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {isHebrew ? 'אין תוצאות מתאימות' : 'No matches'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => {
            const isConfirming = confirmingDelete === r.id;
            const isBusy = busyId === r.id;
            return (
              <Card
                key={r.id}
                className="hover:border-brand-300 group relative h-full"
                style={{ viewTransitionName: `resume-card-${r.id}` }}
              >
                <Link
                  href={{ pathname: '/builder', query: { id: r.id } }}
                  className="block"
                  aria-label={isHebrew ? `ערוך ${r.title}` : `Edit ${r.title}`}
                  onClick={(e) => {
                    // Let modified clicks (open in new tab/window) and
                    // non-primary buttons behave natively — the morph
                    // only makes sense for an in-place navigation.
                    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                      return;
                    }
                    e.preventDefault();
                    navigateWithViewTransition(() =>
                      router.push({ pathname: '/builder', query: { id: r.id } }),
                    );
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="line-clamp-1 pe-8 text-base">{r.title}</CardTitle>
                      <ArrowRight className="text-brand-400 group-hover:text-brand-600 h-4 w-4 flex-shrink-0 transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 font-medium">
                        {r.locale.toUpperCase()}
                      </span>
                      {r.industry && (
                        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium">
                          {r.industry}
                        </span>
                      )}
                      {typeof r.atsScore === 'number' && (
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${atsScoreBadgeClass(r.atsScore)}`}
                        >
                          ATS {r.atsScore}
                        </span>
                      )}
                      <span className="text-muted-foreground ms-auto">
                        {new Date(r.updatedAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Link>

                {/* Inline actions menu — positioned absolutely so it doesn't
                    push card content around. Click stops propagation so the
                    Link wrapper above doesn't navigate when the menu opens. */}
                <CardActionsMenu
                  resumeId={r.id}
                  isHebrew={isHebrew}
                  isConfirming={isConfirming}
                  isBusy={isBusy}
                  onAskDelete={() => setConfirmingDelete(r.id)}
                  onCancelDelete={() => setConfirmingDelete(null)}
                  onConfirmDelete={() => handleDelete(r.id)}
                  onDuplicate={() => handleDuplicate(r.id)}
                  labelEdit={t('edit')}
                  labelDuplicate={t('duplicate')}
                  labelDelete={t('delete')}
                  labelDownload={t('downloadPdf')}
                  labelConfirmDelete={t('confirmDelete')}
                  labelCancel={t('cancel')}
                />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MenuProps {
  resumeId: string;
  isHebrew: boolean;
  isConfirming: boolean;
  isBusy: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onDuplicate: () => void;
  labelEdit: string;
  labelDuplicate: string;
  labelDelete: string;
  labelDownload: string;
  labelConfirmDelete: string;
  labelCancel: string;
}

function CardActionsMenu({
  resumeId,
  isHebrew,
  isConfirming,
  isBusy,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onDuplicate,
  labelEdit,
  labelDuplicate,
  labelDelete,
  labelDownload,
  labelConfirmDelete,
  labelCancel,
}: MenuProps) {
  const [open, setOpen] = useState(false);

  // Two-stage delete confirmation: clicking Delete swaps the menu to a
  // [Yes, delete] / [Cancel] pair. Escape closes the whole menu.
  if (isConfirming) {
    return (
      <div
        className="glass-strong animate-liquid-pop absolute end-2 top-2 z-10 flex items-center gap-1 rounded-xl p-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onCancelDelete();
            setOpen(false);
          }
        }}
        role="alertdialog"
        aria-label={labelConfirmDelete}
      >
        <span className="text-muted-foreground px-2 text-xs">{labelConfirmDelete}</span>
        <Button
          variant="destructive"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={isBusy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onConfirmDelete();
          }}
        >
          {isBusy ? '…' : isHebrew ? 'מחק' : 'Delete'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCancelDelete();
          }}
        >
          {labelCancel}
        </Button>
      </div>
    );
  }

  return (
    <div
      className="absolute end-2 top-2 z-10"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:bg-accent hover:text-foreground ease-snappy rounded-full p-1 opacity-0 transition-all duration-200 focus:opacity-100 active:scale-90 group-hover:opacity-100"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={isHebrew ? 'תפריט פעולות' : 'Actions menu'}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="glass-strong animate-liquid-pop absolute end-0 top-full mt-1 min-w-[10rem] overflow-hidden rounded-2xl py-1 text-sm"
        >
          <Link
            role="menuitem"
            href={{ pathname: '/builder', query: { id: resumeId } }}
            className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5"
            onClick={() => setOpen(false)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {labelEdit}
          </Link>
          <button
            type="button"
            role="menuitem"
            className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-start"
            onClick={() => {
              setOpen(false);
              onDuplicate();
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            {labelDuplicate}
          </button>
          <a
            role="menuitem"
            href={`/api/resumes/${resumeId}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5"
            onClick={() => setOpen(false)}
          >
            <Download className="h-3.5 w-3.5" />
            {labelDownload}
          </a>
          <div className="my-1 border-t" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-red-600 hover:bg-red-50"
            onClick={() => {
              setOpen(false);
              onAskDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {labelDelete}
          </button>
        </div>
      )}
    </div>
  );
}
