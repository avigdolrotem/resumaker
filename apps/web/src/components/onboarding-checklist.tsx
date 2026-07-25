'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, Sparkles, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';

const DISMISSED_FOR_SESSION_KEY = 'resumaker:onboarding-checklist-dismissed-session';

interface ChecklistItem {
  /** Stable identifier (used as React key). */
  id: string;
  /** Display title in the active locale. */
  title: string;
  /** One-line helper text. */
  description: string;
  /** Whether the user has completed this step. */
  done: boolean;
  /** Link target — undefined for already-done items. */
  href?:
    | '/builder'
    | '/cover-letters/new'
    | '/account/billing'
    | '/profile'
    | '/resumes'
    | '/career-profile/onboarding';
}

/**
 * Dashboard onboarding checklist.
 *
 * Shown only when the user is new (no resumes yet) — auto-hides once
 * they've completed every step, same as before. On top of that, an X
 * (top-right) now offers an explicit dismiss, since some users know
 * exactly what they want and find an unfinished checklist noisier than
 * helpful: clicking it asks "for now" (sessionStorage — reappears next
 * session) vs "don't show again" (server-persisted in
 * users.featureFlags — see /api/user/dashboard-prefs), rather than
 * silently picking one for them.
 */
export function OnboardingChecklist({
  items,
  locale,
  initiallyDismissedForever,
}: {
  items: ChecklistItem[];
  locale: 'he' | 'en';
  /** From users.featureFlags.onboardingChecklistDismissed, read server-side. */
  initiallyDismissedForever: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [dismissedForever, setDismissedForever] = useState(initiallyDismissedForever);
  const [dismissedForSession, setDismissedForSession] = useState(
    () =>
      typeof window !== 'undefined' && sessionStorage.getItem(DISMISSED_FOR_SESSION_KEY) === '1',
  );

  const completedCount = items.filter((i) => i.done).length;
  const total = items.length;
  const isComplete = completedCount === total;

  if (isComplete || dismissedForever || dismissedForSession) return null;

  function dismissForNow() {
    sessionStorage.setItem(DISMISSED_FOR_SESSION_KEY, '1');
    setDismissedForSession(true);
  }

  function dismissForever() {
    setDismissedForever(true); // optimistic — this card is gone either way once state flips
    void fetch('/api/user/dashboard-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingChecklistDismissed: true }),
    });
  }

  return (
    <Card className="border-brand-200 dark:border-brand-800/60 from-brand-50/40 to-card dark:from-brand-950/30 dark:to-card relative bg-gradient-to-br">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={locale === 'he' ? 'סגור' : 'Dismiss'}
        className="text-muted-foreground hover:bg-accent/60 hover:text-foreground ease-smooth absolute end-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200"
      >
        <X className="h-4 w-4" />
      </button>

      {confirming ? (
        <CardContent className="space-y-3 pt-6">
          <p className="text-foreground text-sm font-medium">
            {locale === 'he' ? 'להסתיר את זה?' : 'Hide this?'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={dismissForNow}>
              {locale === 'he' ? 'רק לעכשיו' : 'Just for now'}
            </Button>
            <Button size="sm" variant="outline" onClick={dismissForever}>
              {locale === 'he' ? 'אל תציג שוב' : "Don't show again"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              {locale === 'he' ? 'ביטול' : 'Cancel'}
            </Button>
          </div>
        </CardContent>
      ) : (
        <>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 pe-8 text-lg">
              <Sparkles className="text-brand-500 h-5 w-5" />
              {locale === 'he' ? 'בואו נתחיל' : "Let's get you set up"}
            </CardTitle>
            <CardDescription>
              {locale === 'he'
                ? `${completedCount} מתוך ${total} הושלם`
                : `${completedCount} of ${total} complete`}
            </CardDescription>
            {/* Progress bar */}
            <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-brand-500 h-full rounded-full transition-all"
                style={{ width: `${(completedCount / total) * 100}%` }}
              />
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {items.map((item, index) => {
                const Icon = item.done ? CheckCircle2 : Circle;
                const content = (
                  <div className="flex items-start gap-3">
                    <Icon
                      className={`mt-0.5 h-5 w-5 shrink-0 ${
                        item.done ? 'text-emerald-500' : 'text-muted-foreground/50'
                      }`}
                    />
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          item.done ? 'text-muted-foreground line-through' : 'text-foreground'
                        }`}
                      >
                        {index + 1}. {item.title}
                      </p>
                      {!item.done && (
                        <p className="text-muted-foreground mt-0.5 text-xs">{item.description}</p>
                      )}
                    </div>
                  </div>
                );

                return (
                  <li key={item.id}>
                    {item.href && !item.done ? (
                      <Link
                        href={item.href}
                        className="hover:bg-brand-50/40 dark:hover:bg-brand-950/30 ease-smooth -mx-2 block rounded-xl px-2 py-1.5 transition-colors duration-300"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="-mx-2 px-2 py-1.5">{content}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </>
      )}
    </Card>
  );
}
