'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Star, ExternalLink, Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import type { JobListRow } from '@/lib/jobs-query';

interface Props {
  initialJobs: JobListRow[];
  initialCursor: string | null;
  initialHasMore: boolean;
  isHebrew: boolean;
}

/**
 * The actual job cards + "Load more" pagination for /jobs. Split out
 * from the page (a Server Component) because paging needs client-side
 * fetch + state — the page still does the first, server-rendered page
 * itself (via the same listJobs() this calls for every page after),
 * so first paint is unchanged and only "Load more" costs a round trip.
 *
 * Previously the page hard-capped at 20 rows with no way to see more —
 * fine when the table had a handful of manually-imported jobs, not
 * once the scrapers actually populated it (2.5k+ rows).
 */
export function JobsList({ initialJobs, initialCursor, initialHasMore, isHebrew }: Props) {
  const t = useTranslations('jobs');
  const [jobs, setJobs] = useState(initialJobs);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/jobs?cursor=${encodeURIComponent(cursor)}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        jobs: JobListRow[];
        nextCursor: string | null;
        hasMore: boolean;
      };
      setJobs((prev) => [...prev, ...data.jobs]);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {jobs.map((j, i) => (
          <Card
            key={j.id}
            className="animate-slide-up hover:border-violet-300"
            style={
              i < 8 ? { animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' } : undefined
            }
          >
            <CardContent className="space-y-2 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 font-semibold">
                    {/* Stretched link: the ::after pseudo-element covers
                        the whole (relatively-positioned, overflow-hidden)
                        Card, making the entire card clickable while the
                        real link element stays just the title text. The
                        "view original" <a> below sits in normal document
                        flow with no z-index of its own — later paint
                        order alone puts it above this pseudo-element, so
                        its own click still registers instead of the
                        stretched link swallowing it (can't nest <a> in
                        <a>, so this is the standard way to do both). */}
                    <Link
                      href={`/jobs/${j.id}`}
                      className="after:absolute after:inset-0 hover:text-violet-700"
                    >
                      {j.title}
                    </Link>
                  </h3>
                  <p className="text-muted-foreground line-clamp-1 text-sm">
                    {j.company}
                    {j.location ? ` · ${j.location}` : ''}
                    {j.remote ? ` · ${isHebrew ? 'מרחוק' : 'Remote'}` : ''}
                  </p>
                </div>
                {j.isFavorite && (
                  <Star className="h-4 w-4 flex-shrink-0 fill-amber-400 text-amber-400" />
                )}
              </div>
              {j.descriptionPreview && (
                <p className="text-muted-foreground line-clamp-2 text-sm">{j.descriptionPreview}</p>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {j.source} ·{' '}
                  {new Date(j.scrapedAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US')}
                </span>
                <div className="flex items-center gap-3">
                  {j.fitScore !== null && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      {j.fitScore}/10
                    </span>
                  )}
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground relative inline-flex items-center gap-1"
                    aria-label={t('viewOriginal')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => void loadMore()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
