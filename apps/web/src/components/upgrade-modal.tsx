'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Feature names — typed so telemetry stays clean. Add new ones as
 * gates appear in the app. Used to look up the right strings + the
 * right tier in i18n.
 */
export type FeatureGateName =
  | 'model_choice'
  | 'cover_letter'
  | 'resume_limit'
  | 'generation_limit'
  | 'template_locked'
  | 'job_hunt_beta';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which feature triggered the gate — drives copy + telemetry. */
  feature: FeatureGateName;
  /** Lowest tier that unlocks this feature. */
  requiredTier: 'plus' | 'pro';
}

/**
 * Premium-gate modal. Compact (NOT full-screen), portaled to body so
 * it escapes any backdrop-filter ancestor's containing block (same
 * trick as MobileDrawer). Locale-aware close button — top-end in
 * both LTR + RTL.
 *
 * CTA is PAYMENT_PROVIDER-aware:
 *   - `none`         → "Join the waitlist" → mailto: matching the
 *                       existing pricing-page waitlist UX
 *   - `stripe` /
 *     `lemonsqueezy` → "Upgrade to <tier>" → /pricing
 *
 * The PAYMENT_PROVIDER read happens at render time via the i18n
 * resolution (different translation keys per provider) so the same
 * component code works across all three modes.
 */
export function UpgradeModal({ open, onOpenChange, feature, requiredTier }: UpgradeModalProps) {
  const t = useTranslations('upgradeModal');
  const closeRef = useRef<HTMLButtonElement>(null);

  // Portal target — only available client-side, after hydration.
  const portalTargetRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    portalTargetRef.current = document.body;
  }, []);

  // Body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes + autofocus the close button when opened so keyboard
  // users land inside the dialog (focus trap is light — we don't loop
  // tabs, but the close button is always reachable).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    window.addEventListener('keydown', onKey);
    const id = requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(id);
    };
  }, [open, onOpenChange]);

  if (!open || !portalTargetRef.current) return null;

  // CTA is a mailto: to match the existing pricing-page waitlist UX
  // when PAYMENT_PROVIDER=none. Once payments go live, swap the
  // translation key's value to a /pricing href and this code is
  // unchanged.
  const ctaHref = t('cta.href', {
    feature,
    defaultValue: `mailto:hello@resumaker.co.il?subject=Waitlist%20-%20${encodeURIComponent(feature)}`,
  });

  const titleId = `upgrade-modal-title-${feature}`;
  const descId = `upgrade-modal-desc-${feature}`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div
        className="motion-safe:animate-in motion-safe:fade-in absolute inset-0 bg-neutral-950/60 backdrop-blur-sm motion-safe:duration-150"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        className={cn(
          'bg-card border-border relative w-full max-w-md rounded-xl border p-6 shadow-2xl',
          'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200',
        )}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t('close')}
          className="text-muted-foreground hover:bg-muted hover:text-foreground absolute end-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md transition"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="bg-brand-50 dark:bg-brand-900/40 mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg">
          {requiredTier === 'pro' ? (
            <Sparkles className="text-brand-600 dark:text-brand-300 h-5 w-5" />
          ) : (
            <Lock className="text-brand-600 dark:text-brand-300 h-5 w-5" />
          )}
        </div>

        <h2 id={titleId} className="text-foreground text-lg font-semibold">
          {t(`features.${feature}.title`, {
            defaultValue:
              requiredTier === 'pro' ? 'This is a Pro feature' : 'This is a Plus feature',
          })}
        </h2>
        <p id={descId} className="text-muted-foreground mt-2 text-sm">
          {t(`features.${feature}.body`, {
            defaultValue:
              requiredTier === 'pro'
                ? 'Resumaker Pro is launching soon. Join the waitlist and we’ll email you when it’s ready.'
                : 'Resumaker Plus is launching soon. Join the waitlist and we’ll email you when it’s ready.',
          })}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('later')}
          </Button>
          <Button asChild>
            <a href={ctaHref} target={ctaHref.startsWith('mailto:') ? '_self' : '_blank'}>
              {t('cta.label')}
            </a>
          </Button>
        </div>
      </div>
    </div>,
    portalTargetRef.current,
  );
}
