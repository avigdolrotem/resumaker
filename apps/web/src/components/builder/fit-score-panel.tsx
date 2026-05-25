'use client';

import { useEffect, useState } from 'react';
import type { Resume } from '@resumaker/shared';
import { CheckCircle, AlertCircle, Zap, Loader2 } from 'lucide-react';

/**
 * Job-fit score card pinned above the live preview when a JD is set
 * in the basic-mode "Job description" field. Auto-fetches 5s after
 * the resume content settles to avoid hammering the API on every
 * keystroke.
 *
 * Score color is the conventional traffic-light: ≥7 green, 5-6 yellow,
 * <5 red. Empty JD = panel doesn't render.
 */

interface FitScore {
  score: number;
  missing_keywords: string[];
  strengths: string[];
  rationale: string;
}

export interface FitScorePanelProps {
  resume: Resume;
  jobDescription: string;
}

export function FitScorePanel({ resume, jobDescription }: FitScorePanelProps) {
  const [score, setScore] = useState<FitScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobDescription.trim() || jobDescription.length < 10) {
      setScore(null);
      return;
    }
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/resumes/fit-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume, jobDescription }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as FitScore;
        setScore(data);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }, 5_000); // 5s idle debounce
    return () => window.clearTimeout(handle);
  }, [resume, jobDescription]);

  if (!jobDescription.trim() || jobDescription.length < 10) return null;

  const color = score
    ? score.score >= 7
      ? 'text-green-500'
      : score.score >= 5
        ? 'text-yellow-500'
        : 'text-red-500'
    : 'text-muted-foreground';
  const Icon = score
    ? score.score >= 7
      ? CheckCircle
      : score.score >= 5
        ? Zap
        : AlertCircle
    : Zap;

  return (
    <div className="border-border bg-card mb-3 rounded-xl border p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">Job fit</h3>
        {loading && <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />}
      </div>
      {score ? (
        <>
          <div className="mt-1 flex items-baseline gap-2">
            <Icon className={`h-5 w-5 ${color}`} />
            <span className={`text-2xl font-bold ${color}`}>{score.score}/10</span>
          </div>
          {score.rationale && (
            <p className="text-foreground/80 mt-2 text-xs leading-relaxed">{score.rationale}</p>
          )}
          {score.strengths.length > 0 && (
            <div className="mt-2">
              <p className="text-muted-foreground text-xs font-medium">Strengths</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {score.strengths.map((s) => (
                  <span
                    key={s}
                    className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800 dark:bg-green-950 dark:text-green-200"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {score.missing_keywords.length > 0 && (
            <div className="mt-2">
              <p className="text-muted-foreground text-xs font-medium">Missing</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {score.missing_keywords.map((k) => (
                  <span
                    key={k}
                    className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800 dark:bg-red-950 dark:text-red-200"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : error ? (
        <p className="text-destructive mt-1 text-xs">{error}</p>
      ) : (
        <p className="text-muted-foreground mt-1 text-xs">
          Scoring after you stop editing for 5 seconds…
        </p>
      )}
    </div>
  );
}
