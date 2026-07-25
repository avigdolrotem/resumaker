'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Star, Sparkles, ClipboardCheck, X, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch, ApiTierError } from '@/lib/api-client';

interface Props {
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  /** null for manually-pasted jobs — there's no real link to share. */
  jobUrl: string | null;
  isFavorite: boolean;
  fitScore: number | null;
  fitRationale: string | null;
  fitStrengths: string[];
  fitGaps: string[];
  alreadyTracked: boolean;
  /** The applications row id when alreadyTracked — needed to untrack. Null otherwise. */
  applicationId: string | null;
  locale: 'he' | 'en';
}

/**
 * Detail-page action strip: favorite toggle, score fit, track application.
 *
 * Track/untrack toggles like favorite does (optimistic, no confirm
 * dialog) — previously track-only was one-way from here (button just
 * disabled once tracked), with the only way back a trip to
 * /applications to find and delete the row there. Untracking here
 * doesn't touch the application's history/notes/status if the user
 * re-tracks later — it's a real DELETE (see /api/applications/[id]),
 * so re-tracking after untracking starts a fresh row, same as if it
 * had never been tracked.
 */
export function JobActions({
  jobId,
  jobTitle,
  jobCompany,
  jobUrl,
  isFavorite: initialFav,
  fitScore,
  fitRationale,
  fitStrengths,
  fitGaps,
  alreadyTracked: initialTracked,
  applicationId: initialApplicationId,
  locale,
}: Props) {
  const t = useTranslations('jobs');
  const router = useRouter();
  const [fav, setFav] = useState(initialFav);
  const [tracked, setTracked] = useState(initialTracked);
  const [applicationId, setApplicationId] = useState(initialApplicationId);
  const [scoring, setScoring] = useState(false);
  const [tracking, setTracking] = useState(false);

  async function toggleFav() {
    const next = !fav;
    setFav(next); // optimistic
    try {
      const res = await apiFetch(`/api/jobs/${jobId}/favorite`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
    } catch (err) {
      setFav(!next);
      // ApiTierError = 402; the global ApiUpgradeListener already opened the upgrade modal.
      if (err instanceof ApiTierError) return;
      toast.error(locale === 'he' ? 'שמירה נכשלה' : 'Failed');
    }
  }

  async function scoreFit() {
    setScoring(true);
    try {
      const res = await apiFetch(`/api/jobs/${jobId}/fit`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? (locale === 'he' ? 'חישוב נכשל' : 'Couldn’t score'));
        return;
      }
      router.refresh();
    } catch (err) {
      if (err instanceof ApiTierError) return;
      toast.error((err as Error).message);
    } finally {
      setScoring(false);
    }
  }

  async function trackApplication() {
    setTracking(true);
    try {
      const res = await apiFetch('/api/applications', {
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
      setApplicationId(data.id ?? null);
      toast.success(locale === 'he' ? 'במעקב' : 'Tracked');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiTierError) return;
      toast.error((err as Error).message);
    } finally {
      setTracking(false);
    }
  }

  async function untrackApplication() {
    if (!applicationId) return;
    setTracking(true);
    const prevId = applicationId;
    setTracked(false); // optimistic
    setApplicationId(null);
    try {
      const res = await apiFetch(`/api/applications/${prevId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success(locale === 'he' ? 'הוסר מהמעקב' : 'Untracked');
      router.refresh();
    } catch {
      setTracked(true);
      setApplicationId(prevId);
      toast.error(locale === 'he' ? 'ההסרה נכשלה' : "Couldn't untrack");
    } finally {
      setTracking(false);
    }
  }

  // Shares the original posting URL (job.url — always present, it's how
  // the listing got imported in the first place), via the native share
  // sheet where supported, falling back to copy-link + toast on
  // desktop. Deliberately not a Resumaker-hosted link: that would need
  // its own public-but-gated route and a real decision on what "gated"
  // means here (sign-in to view? just email-verified? open to anyone
  // with the link?) — punting on that until there's a concrete reason
  // to build it, rather than guessing.
  async function shareJob() {
    if (!jobUrl) return;
    const shareData = {
      title: `${jobTitle} · ${jobCompany}`,
      url: jobUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User canceled the native share sheet — not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(jobUrl);
      toast.success(locale === 'he' ? 'הקישור הועתק' : 'Link copied');
    } catch {
      toast.error(locale === 'he' ? 'ההעתקה נכשלה' : 'Copy failed');
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
        <Button
          variant={tracked ? 'outline' : 'default'}
          onClick={() => void (tracked ? untrackApplication() : trackApplication())}
          disabled={tracking}
        >
          {tracked ? (
            <>
              <X className="me-2 h-4 w-4" />
              {tracking ? '…' : locale === 'he' ? 'הסר ממעקב' : 'Untrack'}
            </>
          ) : (
            <>
              <ClipboardCheck className="me-2 h-4 w-4" />
              {tracking ? '…' : t('trackApplication')}
            </>
          )}
        </Button>
        {jobUrl && (
          <Button variant="outline" onClick={() => void shareJob()}>
            <Share2 className="me-2 h-4 w-4" />
            {locale === 'he' ? 'שתף' : 'Share'}
          </Button>
        )}
      </div>

      {fitScore !== null && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-violet-700">{fitScore}/10</span>
              <span className="text-muted-foreground text-sm font-medium">{t('fitScore')}</span>
            </div>
            {fitRationale && (
              <p className="text-foreground text-sm">
                <strong className="text-foreground">{t('rationale')}: </strong>
                {fitRationale}
              </p>
            )}
            {fitStrengths.length > 0 && (
              <div className="text-sm">
                <strong className="text-emerald-700">{t('strengths')}: </strong>
                <ul className="text-foreground ms-5 list-disc">
                  {fitStrengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {fitGaps.length > 0 && (
              <div className="text-sm">
                <strong className="text-amber-700">{t('gaps')}: </strong>
                <ul className="text-foreground ms-5 list-disc">
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
