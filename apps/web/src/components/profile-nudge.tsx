'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  missingFieldLabels: string[];
  isHebrew: boolean;
}

const SNOOZE_DAYS = 14;

/**
 * Small dismissible nudge for career-profile sections that are still
 * blank (skills, certifications, etc.) — separate from the onboarding
 * checklist above it, which tracks one-time setup milestones (create a
 * resume, see an ATS score...) rather than ongoing profile richness.
 * A thin profile quietly produces thinner tailored resumes forever;
 * this exists to surface that instead of leaving it silent.
 *
 * Dismiss is a snooze, not a permanent flag (unlike the onboarding
 * checklist's "don't show again") — the fields it's pointing at can
 * keep being empty indefinitely, so re-surfacing in two weeks is more
 * useful than either nagging every visit or going silent forever after
 * one click.
 */
export function ProfileNudge({ missingFieldLabels, isHebrew }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || missingFieldLabels.length === 0) return null;

  function snooze() {
    setDismissed(true); // optimistic — gone either way once state flips
    const until = new Date(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    void fetch('/api/user/dashboard-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileNudgeSnoozedUntil: until }),
    });
  }

  const fieldList = missingFieldLabels.join(isHebrew ? ', ' : ', ');

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <p className="text-muted-foreground text-sm">
          {isHebrew
            ? `הפרופיל שלכם עדיין חסר: ${fieldList}. השלמתו משפרת את ההתאמה של קורות החיים שנוצרים.`
            : `Your profile is still missing: ${fieldList}. Filling it in helps every resume you generate fit better.`}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/career-profile">{isHebrew ? 'השלם פרופיל' : 'Complete profile'}</Link>
          </Button>
          <button
            type="button"
            onClick={snooze}
            aria-label={isHebrew ? 'הזכר לי מאוחר יותר' : 'Remind me later'}
            title={isHebrew ? 'הזכר לי מאוחר יותר' : 'Remind me later'}
            className="text-muted-foreground hover:bg-accent/60 hover:text-foreground ease-smooth inline-flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
