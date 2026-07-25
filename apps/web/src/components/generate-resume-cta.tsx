'use client';

import { Sparkles } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { RESUME_BUILDER_PREFILL_KEY } from '@/lib/resume-builder-prefill';

interface Props {
  jobDescription: string;
  /** null for manually-pasted jobs with no real URL — the result screen just won't offer a "view original" link. */
  jobUrl: string | null;
  isHebrew: boolean;
}

/**
 * Large, prominent "Generate resume for this job" CTA below the job
 * description on the detail page — the small action-strip buttons up
 * top (favorite/track/score) are utility actions; this is the actual
 * point of looking at a job at all, so it gets its own visual weight
 * rather than being one more button in that row.
 */
export function GenerateResumeCta({ jobDescription, jobUrl, isHebrew }: Props) {
  const router = useRouter();

  function handleClick() {
    sessionStorage.setItem(
      RESUME_BUILDER_PREFILL_KEY,
      JSON.stringify({ jobDescription, ...(jobUrl && { jobUrl }) }),
    );
    router.push('/builder');
  }

  return (
    <Button size="lg" className="w-full text-base" onClick={handleClick}>
      <Sparkles className="me-2 h-5 w-5" />
      {isHebrew ? 'צור קורות חיים למשרה הזו' : 'Generate resume for this job'}
    </Button>
  );
}
