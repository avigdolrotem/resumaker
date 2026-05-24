'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Step {
  selector?: string; // CSS selector to highlight; if absent, centered modal
  title: string;
  body: string;
  ctaHref?: string;
}

/**
 * Welcome tour — shown to first-time signed-in users.
 *
 * Custom implementation rather than Shepherd.js (no extra dep). Reads
 * localStorage flag `resumaker.tour.completed` — once set, never shows
 * again. Skippable from any step via X button.
 *
 * Steps are translation-driven so HE + EN both work; mount this once
 * at app layout level (inside ClientProviders if any).
 */
export function WelcomeTour() {
  const t = useTranslations('tour');
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem('resumaker.tour.completed');
      if (!done) setVisible(true);
    } catch {
      // Safari private mode etc — show the tour anyway
      setVisible(true);
    }
  }, []);

  function close(completed = false) {
    setVisible(false);
    try {
      if (completed) localStorage.setItem('resumaker.tour.completed', String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  if (!visible) return null;

  // Five-step tour. Each step references translation keys so HE + EN
  // localization stays in messages files.
  const STEPS: Step[] = [
    { title: t('s1.title'), body: t('s1.body') },
    { title: t('s2.title'), body: t('s2.body'), ctaHref: '/builder' },
    { title: t('s3.title'), body: t('s3.body'), ctaHref: '/dashboard' },
    { title: t('s4.title'), body: t('s4.body'), ctaHref: '/settings' },
    { title: t('s5.title'), body: t('s5.body') },
  ];
  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close(false);
      }}
    >
      <div className="relative w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={() => close(false)}
          className="absolute end-4 top-4 text-neutral-400 hover:text-neutral-700"
          aria-label={t('skip')}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex gap-1">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-violet-600' : 'bg-neutral-200'}`}
            />
          ))}
        </div>

        <h2 id="tour-title" className="text-lg font-semibold">
          {current.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700">{current.body}</p>

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="me-1 h-3.5 w-3.5 rtl:rotate-180" />
            {t('previous')}
          </Button>

          {current.ctaHref && !isLast ? (
            <a
              href={current.ctaHref}
              onClick={() => close(true)}
              className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              {t('visit')}
            </a>
          ) : isLast ? (
            <Button size="sm" onClick={() => close(true)}>
              {t('done')}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>
              {t('next')}
              <ArrowRight className="ms-1 h-3.5 w-3.5 rtl:rotate-180" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
