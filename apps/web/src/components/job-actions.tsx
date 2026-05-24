'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Star, Sparkles, ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  jobId: string;
  isFavorite: boolean;
  fitScore: number | null;
  fitRationale: string | null;
  fitStrengths: string[];
  fitGaps: string[];
  alreadyTracked: boolean;
  locale: 'he' | 'en';
}

/**
 * Detail-page action strip: favorite toggle, score fit, track application.
 *
 * Score-fit and track are non-blocking — toast on failure. Track is the
 * only action that's one-way (once tracked, button disables and we send
 * the user to /applications to manage it).
 */
export function JobActions({
  jobId,
  isFavorite: initialFav,
  fitScore,
  fitRationale,
  fitStrengths,
  fitGaps,
  alreadyTracked: initialTracked,
  locale,
}: Props) {
  const t = useTranslations('jobs');
  const router = useRouter();
  const [fav, setFav] = useState(initialFav);
  const [tracked, setTracked] = useState(initialTracked);
  const [scoring, setScoring] = useState(false);
  const [tracking, setTracking] = useState(false);

  async function toggleFav() {
    const next = !fav;
    setFav(next); // optimistic
    try {
      const res = await fetch(`/api/jobs/${jobId}/favorite`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setFav(!next);
      toast.error(locale === 'he' ? 'שמירה נכשלה' : 'Failed');
    }
  }

  async function scoreFit() {
    setScoring(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/fit`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? (locale === 'he' ? 'חישוב נכשל' : 'Couldn’t score'));
        return;
      }
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setScoring(false);
    }
  }

  async function trackApplication() {
    setTracking(true);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: 'interested' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? (locale === 'he' ? 'שגיאה' : 'Failed'));
        return;
      }
      setTracked(true);
      toast.success(locale === 'he' ? 'במעקב' : 'Tracked');
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTracking(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant={fav ? 'default' : 'outline'} onClick={toggleFav}>
          <Star className={`me-2 h-4 w-4 ${fav ? 'fill-current' : ''}`} />
          {fav ? t('unfavorite') : t('favorite')}
        </Button>
        <Button variant="outline" onClick={scoreFit} disabled={scoring}>
          <Sparkles className="me-2 h-4 w-4" />
          {scoring ? t('scoring') : t('scoreFit')}
        </Button>
        <Button variant="default" onClick={trackApplication} disabled={tracked || tracking}>
          {tracked ? (
            <>
              <CheckCircle2 className="me-2 h-4 w-4" />
              {t('tracked')}
            </>
          ) : (
            <>
              <ClipboardCheck className="me-2 h-4 w-4" />
              {tracking ? '…' : t('trackApplication')}
            </>
          )}
        </Button>
      </div>

      {fitScore !== null && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-violet-700">{fitScore}/10</span>
              <span className="text-sm font-medium text-neutral-600">{t('fitScore')}</span>
            </div>
            {fitRationale && (
              <p className="text-sm text-neutral-700">
                <strong className="text-neutral-900">{t('rationale')}: </strong>
                {fitRationale}
              </p>
            )}
            {fitStrengths.length > 0 && (
              <div className="text-sm">
                <strong className="text-emerald-700">{t('strengths')}: </strong>
                <ul className="ms-5 list-disc text-neutral-700">
                  {fitStrengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {fitGaps.length > 0 && (
              <div className="text-sm">
                <strong className="text-amber-700">{t('gaps')}: </strong>
                <ul className="ms-5 list-disc text-neutral-700">
                  {fitGaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
