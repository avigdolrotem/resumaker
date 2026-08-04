'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Star, ExternalLink, Loader2, BadgeCheck } from 'lucide-react';
import { Link, useRouter, usePathname } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { JobListRow } from '@/lib/jobs-query';

interface Props {
  initialJobs: JobListRow[];
  initialPage: number;
  totalPages: number;
  totalCount: number;
  isHebrew: boolean;
}

/**
 * The actual job cards + real page navigation for /jobs (page=1,2,3…
 * in the URL, not an ever-growing "Load more" list — the underlying
 * data still comes from the server on every page change, same
 * listJobs() the page itself calls, so this component holds no jobs
 * state of its own: changing ?page= re-renders the Server Component
 * with fresh props, this just displays whatever it's handed.
 *
 * Previously hard-capped at 20 rows with no way to see more, then
 * "Load more" (append-only, no discrete pages) — replaced with real
 * pagination once the table actually had enough rows (7k+) for
 * "which page am I on" to matter.
 */
export function JobsList({
  initialJobs: jobs,
  initialPage,
  totalPages,
  totalCount,
  isHebrew,
}: Props) {
  const t = useTranslations('jobs');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function goToPage(n: number) {
    if (n < 1 || n > totalPages || isPending) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(n));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: true });
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {isHebrew
          ? `${totalCount.toLocaleString('he-IL')} משרות · עמוד ${initialPage} מתוך ${totalPages}`
          : `${totalCount.toLocaleString('en-US')} jobs · page ${initialPage} of ${totalPages}`}
      </p>

      <div className={`grid gap-3 lg:grid-cols-2 xl:grid-cols-3 ${isPending ? 'opacity-60' : ''}`}>
        {jobs.map((j, i) => (
          <Card
            key={j.id}
            interactive={false}
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
                  <p className="text-muted-foreground line-clamp-1 flex items-center gap-1 text-sm">
                    {j.company}
                    {j.source === 'hr' && j.companyVerified && (
                      <BadgeCheck
                        className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                        aria-label={isHebrew ? 'מעסיק מאומת' : 'Verified employer'}
                      />
                    )}
                    {j.location ? ` · ${j.location}` : ''}
                    {j.remote ? ` · ${isHebrew ? 'מרחוק' : 'Remote'}` : ''}
                  </p>
                  {j.source === 'manual' && (
                    <span className="text-muted-foreground mt-1 inline-block rounded-full border border-dashed px-1.5 py-0.5 text-[10px]">
                      {isHebrew ? 'נוסף על ידי משתמש' : 'Community-added'}
                    </span>
                  )}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(initialPage - 1)}
            disabled={initialPage <= 1 || isPending}
            // Icon-only, so without this a screen reader announces bare
            // "button" for both pager controls with nothing to tell them
            // apart.
            aria-label={isHebrew ? 'העמוד הקודם' : 'Previous page'}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <span className="text-muted-foreground min-w-[6rem] text-center text-sm">
            {isPending ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : isHebrew ? (
              `עמוד ${initialPage} מתוך ${totalPages}`
            ) : (
              `Page ${initialPage} of ${totalPages}`
            )}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(initialPage + 1)}
            disabled={initialPage >= totalPages || isPending}
            aria-label={isHebrew ? 'העמוד הבא' : 'Next page'}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      )}
    </div>
  );
}
