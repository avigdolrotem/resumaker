'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Keyword + remote filtering for /jobs.
 *
 * listJobs() has supported `q` (full-text, via websearch_to_tsquery over
 * jobs.searchVector), `remote`, `company` and `source` since it was
 * written — the page simply never passed any of them and rendered no
 * controls, so ~17,000 listings were browse-only across 700 pages of
 * pagination. This is the missing front end for a query layer that was
 * already there.
 *
 * State lives in the URL rather than this component: JobsList's pager
 * copies every existing search param when it changes ?page=, so a query
 * survives paging for free, and a filtered result set is linkable and
 * survives a reload.
 */
export function JobsSearch({ isHebrew }: { isHebrew: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const remote = searchParams.get('remote') === 'true';
  const hasFilters = Boolean(searchParams.get('q') || searchParams.get('remote'));

  function apply(next: { q?: string; remote?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());

    const nextQ = (next.q ?? q).trim();
    if (nextQ) params.set('q', nextQ);
    else params.delete('q');

    const nextRemote = next.remote ?? remote;
    if (nextRemote) params.set('remote', 'true');
    else params.delete('remote');

    // Any change to the filters invalidates the current offset — page 7
    // of the old result set is meaningless against the new one, and
    // landing past the end shows an empty page that reads as "no
    // results" when there are plenty.
    params.delete('page');

    startTransition(() => {
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: true });
    });
  }

  function clear() {
    setQ('');
    startTransition(() => router.push(pathname, { scroll: true }));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:min-w-[18rem]">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 ltr:left-3 rtl:right-3"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply({ q: e.currentTarget.value });
          }}
          placeholder={
            isHebrew ? 'חיפוש לפי תפקיד, חברה או מיומנות…' : 'Search role, company or skill…'
          }
          aria-label={isHebrew ? 'חיפוש משרות' : 'Search jobs'}
          className="border-input bg-background/60 focus-visible:ring-brand-500/18 h-10 w-full rounded-xl border text-sm focus-visible:outline-none focus-visible:ring-4 ltr:pl-9 ltr:pr-3 rtl:pl-3 rtl:pr-9"
        />
      </div>

      <Button type="button" onClick={() => apply({})} disabled={isPending}>
        {isHebrew ? 'חיפוש' : 'Search'}
      </Button>

      <label className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 text-sm transition-colors">
        <input
          type="checkbox"
          checked={remote}
          onChange={(e) => apply({ remote: e.target.checked })}
          className="accent-brand-500 h-4 w-4 rounded"
        />
        {isHebrew ? 'עבודה מרחוק בלבד' : 'Remote only'}
      </label>

      {hasFilters && (
        <button
          type="button"
          onClick={clear}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          {isHebrew ? 'ניקוי' : 'Clear'}
        </button>
      )}
    </div>
  );
}
