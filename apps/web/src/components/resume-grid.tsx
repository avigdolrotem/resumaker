'use client';

import { useMemo, useState } from 'react';
import { Search, X, ArrowRight, FileText, Plus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface ResumeRow {
  id: string;
  title: string;
  locale: string;
  industry: string | null;
  updatedAt: Date | string;
}

/**
 * Filterable resume grid for the dashboard.
 * Client-side search by title + locale + industry chips.
 */
export function ResumeGrid({ resumes, isHebrew }: { resumes: ResumeRow[]; isHebrew: boolean }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return resumes;
    return resumes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.industry ?? '').toLowerCase().includes(q) ||
        r.locale.toLowerCase().includes(q),
    );
  }, [resumes, query]);

  if (resumes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <div className="bg-brand-50 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <FileText className="text-brand-600 h-8 w-8" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">
            {isHebrew ? 'עוד אין לך קורות חיים' : 'No resumes yet'}
          </h3>
          <p className="mb-6 text-sm text-neutral-600">
            {isHebrew ? 'בנה את הראשונים תוך דקות' : 'Build your first in minutes'}
          </p>
          <Button asChild>
            <Link href="/builder">
              <Plus className="me-2 h-4 w-4" />
              {isHebrew ? 'קורות חיים חדשים' : 'New resume'}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {resumes.length >= 4 && (
        <div className="relative max-w-md">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isHebrew ? 'חיפוש לפי כותרת, תחום…' : 'Search by title, industry…'}
            className="pe-9 ps-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">
          {isHebrew ? 'אין תוצאות מתאימות' : 'No matches'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={{ pathname: '/builder', query: { id: r.id } }}
              className="group block"
            >
              <Card className="hover:border-brand-300 hover:shadow-brand-500/5 h-full transition hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="line-clamp-1 text-base">{r.title}</CardTitle>
                    <ArrowRight className="text-brand-400 group-hover:text-brand-600 h-4 w-4 flex-shrink-0 transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 font-medium">
                      {r.locale.toUpperCase()}
                    </span>
                    {r.industry && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600">
                        {r.industry}
                      </span>
                    )}
                    <span className="ms-auto text-neutral-500">
                      {new Date(r.updatedAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
