'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SavedSearch {
  id: string;
  name: string;
  query: { q?: string; company?: string; source?: string; remote?: boolean };
  alertFrequency: 'daily' | 'weekly' | 'off';
  lastNotifiedAt: string | null;
  createdAt: string;
}

/**
 * /jobs/saved-searches — manage saved-search alert subscriptions.
 *
 * Beta-gated like every /jobs/* route. The cron at
 * /api/cron/scrape-jobs runs daily; the digest cron evaluates each
 * saved search against newly-scraped jobs and emails matches.
 */
export default function SavedSearchesPage() {
  const t = useTranslations('jobs.savedSearches');
  const locale = useLocale();
  const BackIcon = locale === 'he' ? ArrowRight : ArrowLeft;
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [q, setQ] = useState('');
  const [company, setCompany] = useState('');
  const [source, setSource] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'off'>('daily');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/saved-searches');
      if (res.ok) {
        const data = await res.json();
        setSearches(data.searches ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    try {
      const body = {
        name,
        query: {
          ...(q ? { q } : {}),
          ...(company ? { company } : {}),
          ...(source ? { source } : {}),
          ...(remoteOnly ? { remote: true } : {}),
        },
        alertFrequency: frequency,
      };
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? t('saveFailed'));
        return;
      }
      toast.success(t('searchSaved'));
      setName('');
      setQ('');
      setCompany('');
      setSource('');
      setRemoteOnly(false);
      void load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/saved-searches/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error(t('deleteFailed'));
      return;
    }
    setSearches((p) => p.filter((s) => s.id !== id));
    toast.success(t('deleted'));
  }

  async function updateFreq(id: string, alertFrequency: 'daily' | 'weekly' | 'off') {
    const res = await fetch(`/api/saved-searches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertFrequency }),
    });
    if (res.ok) {
      setSearches((p) => p.map((s) => (s.id === id ? { ...s, alertFrequency } : s)));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/jobs"
          aria-label={locale === 'he' ? 'חזרה למשרות' : 'Back to jobs'}
          className="text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 -ms-1 mb-2 inline-flex items-center transition-colors"
        >
          <BackIcon className="h-5 w-5" />
        </Link>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            {t('newSearch')}
          </CardTitle>
          <CardDescription>{t('newSearchHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="name">{t('nameLabel')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                required
                maxLength={100}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="q">{t('keywordLabel')}</Label>
                <Input
                  id="q"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('keywordPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">{t('companyLabel')}</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder={t('companyPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">{t('sourceLabel')}</Label>
                <select
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="border-input bg-background/60 text-foreground focus-visible:border-brand-400/60 focus-visible:bg-background ease-smooth focus-visible:ring-brand-500/18 flex h-10 w-full rounded-xl border px-3.5 py-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-4"
                >
                  <option value="">{t('sourceAny')}</option>
                  <option value="greenhouse">Greenhouse</option>
                  <option value="lever">Lever</option>
                  <option value="workable">Workable</option>
                  <option value="ashby">Ashby</option>
                  <option value="manual">{t('sourceManual')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="freq">{t('freqLabel')}</Label>
                <select
                  id="freq"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'off')}
                  className="border-input bg-background/60 text-foreground focus-visible:border-brand-400/60 focus-visible:bg-background ease-smooth focus-visible:ring-brand-500/18 flex h-10 w-full rounded-xl border px-3.5 py-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-4"
                >
                  <option value="daily">{t('freqDaily')}</option>
                  <option value="weekly">{t('freqWeekly')}</option>
                  <option value="off">{t('freqOff')}</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={remoteOnly}
                onChange={(e) => setRemoteOnly(e.target.checked)}
                className="accent-brand-600 h-4 w-4 rounded"
              />
              {t('remoteOnly')}
            </label>
            <Button type="submit" disabled={saving || !name}>
              {saving ? t('saving') : t('save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('yourSearches')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground animate-pulse text-sm">{t('loading')}</p>
          ) : searches.length === 0 ? (
            <div className="animate-fade-in flex flex-col items-center gap-3 py-8 text-center">
              <div className="bg-brand-50 dark:bg-brand-950/40 flex h-11 w-11 items-center justify-center rounded-full">
                <Search className="text-brand-500 h-5 w-5" />
              </div>
              <p className="text-muted-foreground text-sm">{t('none')}</p>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              <AnimatePresence initial={false}>
                {searches.map((s) => (
                  <motion.li
                    key={s.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    className="ease-smooth hover:bg-accent/40 -mx-2 flex items-start justify-between gap-3 rounded-xl px-2 py-3 transition-colors duration-300"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {[
                          s.query.q && `"${s.query.q}"`,
                          s.query.company && `@${s.query.company}`,
                          s.query.source,
                          s.query.remote && t('remoteTag'),
                        ]
                          .filter(Boolean)
                          .join(' · ') || t('anyJob')}
                      </p>
                      <p className="text-muted-foreground mt-1 text-[10px]">
                        {s.lastNotifiedAt
                          ? t('lastDigest', {
                              date: new Date(s.lastNotifiedAt).toLocaleDateString(
                                locale === 'he' ? 'he-IL' : 'en-US',
                              ),
                            })
                          : t('noDigestYet')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={s.alertFrequency}
                        onChange={(e) =>
                          updateFreq(s.id, e.target.value as 'daily' | 'weekly' | 'off')
                        }
                        className="border-input bg-background/60 text-foreground focus-visible:border-brand-400/60 ease-smooth focus-visible:ring-brand-500/18 rounded-lg border px-2 py-1 text-xs backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-4"
                      >
                        <option value="daily">{t('freqDailyShort')}</option>
                        <option value="weekly">{t('freqWeeklyShort')}</option>
                        <option value="off">{t('freqOffShort')}</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                        onClick={() => remove(s.id)}
                        aria-label={t('delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
