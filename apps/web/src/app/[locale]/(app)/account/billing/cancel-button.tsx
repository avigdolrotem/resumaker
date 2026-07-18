'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { LiquidSpinner } from '@/components/ui-effects/liquid-spinner';

/**
 * Self-serve "Cancel subscription" / "Resume subscription" toggle.
 *
 * Cancellation is always scheduled for the end of the current paid
 * period, never immediate — see `setSubscriptionCancellation`'s doc
 * comment in lib/billing/provider.ts for why. Same two-step inline
 * confirm pattern as the account-deletion flow in settings/page.tsx's
 * `DangerTab`: first click arms the confirm state, second performs it.
 */
export function CancelSubscriptionButton({
  cancelAtPeriodEnd,
  periodEndLabel,
}: {
  cancelAtPeriodEnd: boolean;
  /** Pre-formatted, locale-correct date string (or null if unknown). */
  periodEndLabel: string | null;
}) {
  const t = useTranslations('billing');
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function call(resume: boolean) {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? t('cancelFailed'));
        return;
      }
      toast.success(
        resume
          ? t('resumeToastSuccess')
          : periodEndLabel
            ? t('cancelToastSuccess', { date: periodEndLabel })
            : t('cancelToastSuccessNoDate'),
      );
      setConfirming(false);
      router.refresh();
    } catch (err) {
      toast.error(t('cancelFailed'), { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  if (cancelAtPeriodEnd) {
    // Already scheduled to cancel — offer to undo instead.
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void call(true)}
        disabled={loading}
      >
        {loading && <LiquidSpinner size={16} />}
        {loading ? t('resuming') : t('resumeSubscription')}
      </Button>
    );
  }

  if (confirming) {
    return (
      <div className="space-y-2 text-end">
        <p className="text-muted-foreground max-w-56 text-xs">
          {periodEndLabel
            ? t('cancelConfirmDescription', { date: periodEndLabel })
            : t('cancelConfirmDescriptionNoDate')}
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
            disabled={loading}
          >
            {t('keepSubscription')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void call(false)}
            disabled={loading}
          >
            {loading && <LiquidSpinner size={16} />}
            {loading ? t('cancelling') : t('cancelConfirmYes')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
      {t('cancelSubscription')}
    </Button>
  );
}
