'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Star, Sparkles, X, Building2 } from 'lucide-react';
import { useRouter, Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RESUME_BUILDER_PREFILL_KEY } from '@/lib/resume-builder-prefill';

export interface RecommendedJob {
  id: string;
  company: string;
  title: string;
  location: string | null;
  remote: boolean;
  description: string;
  /** jobs.hrUserId !== null — the same signal Stage 2 boosts on. Must stay in sync with recommendations.ts's disclosure requirement. */
  hrPosted: boolean;
  fitScore: number | null;
  fitRationale: string | null;
}

interface Props {
  jobs: RecommendedJob[];
  isHebrew: boolean;
}

/**
 * Dashboard "Recommended for you" section. Server-fetched rows, client
 * component only for the per-card actions (dismiss/favorite/generate
 * resume need fetch + navigation). HR-posted jobs get a visible "Posted
 * directly by {Company}" badge — Rotem's explicit condition on shipping
 * the Stage-2 HR boost at all (see recommendations.ts): the ranking
 * reorder must never be silent.
 */
export function JobRecommendations({ jobs: initialJobs, isHebrew }: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  async function dismiss(id: string) {
    setDismissingId(id);
    const prev = jobs;
    setJobs((js) => js.filter((j) => j.id !== id)); // optimistic
    try {
      const res = await fetch(`/api/jobs/${id}/dismiss`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
    } catch {
      setJobs(prev);
      toast.error(isHebrew ? 'הפעולה נכשלה' : 'Couldn’t dismiss');
    } finally {
      setDismissingId(null);
    }
  }

  async function favorite(id: string) {
    try {
      const res = await fetch(`/api/jobs/${id}/favorite`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      toast.success(isHebrew ? 'נשמר למועדפים' : 'Saved to favorites');
    } catch {
      toast.error(isHebrew ? 'השמירה נכשלה' : 'Save failed');
    }
  }

  function generateResume(job: RecommendedJob) {
    sessionStorage.setItem(
      RESUME_BUILDER_PREFILL_KEY,
      JSON.stringify({ jobDescription: job.description }),
    );
    router.push('/builder');
  }

  if (jobs.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            {isHebrew ? 'מומלץ בשבילך' : 'Recommended for you'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {isHebrew
              ? 'משרות שנבחרו בהתאם לפרופיל הקריירה שלך'
              : 'Jobs matched to your career profile'}
          </p>
        </div>
        <Link href="/jobs" className="text-brand-600 hover:text-brand-700 text-sm font-medium">
          {isHebrew ? 'כל המשרות' : 'All jobs'} →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {jobs.map((job) => (
          <Card key={job.id} className="hover:border-violet-300">
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 font-semibold">
                    <Link href={`/jobs/${job.id}`} className="hover:text-violet-700">
                      {job.title}
                    </Link>
                  </h3>
                  <p className="text-muted-foreground line-clamp-1 text-sm">
                    {job.company}
                    {job.location ? ` · ${job.location}` : ''}
                    {job.remote ? ` · ${isHebrew ? 'מרחוק' : 'Remote'}` : ''}
                  </p>
                </div>
                {job.fitScore !== null && (
                  <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    {job.fitScore}/10
                  </span>
                )}
              </div>

              {job.hrPosted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Building2 className="h-3 w-3 flex-shrink-0" />
                  <span className="line-clamp-1">
                    {isHebrew
                      ? `פורסם ישירות על ידי ${job.company}`
                      : `Posted directly by ${job.company}`}
                  </span>
                </span>
              )}

              {job.fitRationale && (
                <p className="text-muted-foreground line-clamp-2 text-xs">{job.fitRationale}</p>
              )}

              <div className="flex items-center gap-1.5 pt-1">
                <Button size="sm" variant="outline" onClick={() => generateResume(job)}>
                  <Sparkles className="me-1.5 h-3.5 w-3.5" />
                  {isHebrew ? 'צור קורות חיים' : 'Generate resume'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void favorite(job.id)}
                  aria-label={isHebrew ? 'שמור למועדפים' : 'Save to favorites'}
                >
                  <Star className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void dismiss(job.id)}
                  disabled={dismissingId === job.id}
                  aria-label={isHebrew ? 'התעלם' : 'Dismiss'}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
