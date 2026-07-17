'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
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
        toast.error(data.error ?? 'Save failed');
        return;
      }
      toast.success('Search saved');
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
      toast.error('Delete failed');
      return;
    }
    setSearches((p) => p.filter((s) => s.id !== id));
    toast.success('Deleted');
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
        <h1 className="text-3xl font-bold">Saved searches</h1>
        <p className="text-muted-foreground mt-1">
          Get email alerts when new jobs match your criteria.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <Plus className="me-2 inline h-4 w-4" />
            New saved search
          </CardTitle>
          <CardDescription>Leave a field empty to skip that filter.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="name">Search name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Senior backend in Tel Aviv"
                required
                maxLength={100}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="q">Keyword</Label>
                <Input
                  id="q"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="backend, senior, react…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="wix, monday, …"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <select
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="border-input bg-background/60 text-foreground focus-visible:border-brand-400/60 focus-visible:bg-background ease-smooth focus-visible:ring-brand-500/18 flex h-10 w-full rounded-xl border px-3.5 py-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-4"
                >
                  <option value="">Any</option>
                  <option value="greenhouse">Greenhouse</option>
                  <option value="lever">Lever</option>
                  <option value="workable">Workable</option>
                  <option value="ashby">Ashby</option>
                  <option value="manual">Manual paste</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="freq">Alert frequency</Label>
                <select
                  id="freq"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'off')}
                  className="border-input bg-background/60 text-foreground focus-visible:border-brand-400/60 focus-visible:bg-background ease-smooth focus-visible:ring-brand-500/18 flex h-10 w-full rounded-xl border px-3.5 py-2 text-sm shadow-sm backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-4"
                >
                  <option value="daily">Daily digest</option>
                  <option value="weekly">Weekly</option>
                  <option value="off">No email, just saved</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={remoteOnly}
                onChange={(e) => setRemoteOnly(e.target.checked)}
              />
              Remote only
            </label>
            <Button type="submit" disabled={saving || !name}>
              {saving ? 'Saving…' : 'Save search'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your saved searches</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : searches.length === 0 ? (
            <p className="text-muted-foreground text-sm">None yet.</p>
          ) : (
            <ul className="divide-border divide-y">
              {searches.map((s) => (
                <li
                  key={s.id}
                  className="ease-smooth hover:bg-accent/40 -mx-2 flex items-start justify-between gap-3 rounded-xl px-2 py-3 transition-colors duration-300"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {[
                        s.query.q && `"${s.query.q}"`,
                        s.query.company && `@${s.query.company}`,
                        s.query.source,
                        s.query.remote && 'remote',
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'any job'}
                    </p>
                    <p className="text-muted-foreground mt-1 text-[10px]">
                      {s.lastNotifiedAt
                        ? `Last digest: ${new Date(s.lastNotifiedAt).toLocaleDateString()}`
                        : 'No digest sent yet'}
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
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="off">Off</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                      onClick={() => remove(s.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
