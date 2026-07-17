'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Trash2, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const STATUSES = [
  'interested',
  'applied',
  'recruiter_screen',
  'tech_interview',
  'onsite',
  'offer',
  'rejected',
  'ghosted',
] as const;
type Status = (typeof STATUSES)[number];

interface Row {
  id: string;
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  jobUrl: string;
  status: string;
  notes: string | null;
  nextActionAt: Date | null;
  appliedAt: Date | null;
  updatedAt: Date;
}

/**
 * Inline-editable applications list. Status changes PATCH immediately
 * (optimistic). Delete uses a two-stage inline confirm to match the
 * resume-grid pattern.
 */
export function ApplicationsList({ rows, locale }: { rows: Row[]; locale: 'he' | 'en' }) {
  const t = useTranslations('applications');
  const router = useRouter();
  const [local, setLocal] = useState(rows);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function changeStatus(id: string, status: Status) {
    // Optimistic
    setLocal((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      toast.error(locale === 'he' ? 'עדכון נכשל' : 'Update failed');
      router.refresh(); // re-sync
    }
  }

  async function remove(id: string) {
    setLocal((prev) => prev.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success(t('deleted'));
    } catch {
      toast.error(locale === 'he' ? 'מחיקה נכשלה' : 'Delete failed');
      router.refresh();
    } finally {
      setConfirming(null);
    }
  }

  return (
    <div className="space-y-3">
      {local.map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">
                  <Link href={`/jobs/${r.jobId}`} className="hover:text-violet-700">
                    {r.jobTitle}
                  </Link>
                </h3>
                <p className="text-muted-foreground text-sm">{r.jobCompany}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={r.status}
                  onChange={(e) => changeStatus(r.id, e.target.value as Status)}
                  className="border-input bg-background/60 text-foreground focus-visible:border-brand-400/60 focus-visible:bg-background ease-smooth focus-visible:ring-brand-500/18 rounded-lg border px-2 py-1 text-sm backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-4"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}`)}
                    </option>
                  ))}
                </select>
                <a
                  href={r.jobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={locale === 'he' ? 'מודעה' : 'Original posting'}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                {confirming === r.id ? (
                  <div className="flex gap-1">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => remove(r.id)}
                    >
                      {locale === 'he' ? 'מחק' : 'Delete'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setConfirming(null)}
                    >
                      {locale === 'he' ? 'בטל' : 'Cancel'}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => setConfirming(r.id)}
                    aria-label={t('delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {r.appliedAt && (
                <span>
                  {t('appliedAt')}: {new Date(r.appliedAt).toLocaleDateString()}
                </span>
              )}
              {r.nextActionAt && (
                <span>
                  {t('nextActionAt')}: {new Date(r.nextActionAt).toLocaleDateString()}
                </span>
              )}
              <span className="ms-auto">{new Date(r.updatedAt).toLocaleDateString()}</span>
            </div>
            {r.notes && (
              <p className="text-foreground text-sm">
                <strong>{t('notes')}: </strong>
                {r.notes}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
