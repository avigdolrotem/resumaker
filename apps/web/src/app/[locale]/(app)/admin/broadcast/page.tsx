'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface BroadcastRow {
  id: string;
  subject: string;
  locale: string;
  status: string;
  recipientCount: number | null;
  sentAt: string | null;
  createdAt: string;
}

export default function AdminBroadcastPage() {
  const [rows, setRows] = useState<BroadcastRow[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [locale, setLocale] = useState('he');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void fetch('/api/admin/broadcast')
      .then((r) => r.json())
      .then((d: { rows: BroadcastRow[] }) => setRows(d.rows ?? []));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, locale }),
      });
      const data = (await res.json()) as { row: BroadcastRow };
      setRows((prev) => [data.row, ...prev]);
      setSubject('');
      setBody('');
      setMessage('Draft saved.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSend(id: string) {
    if (!confirm('Send this broadcast now?')) return;
    const res = await fetch('/api/admin/broadcast?send=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = (await res.json()) as { recipientCount: number };
    setMessage(`Sent to ${data.recipientCount} recipients.`);
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: 'sent', recipientCount: data.recipientCount } : r,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Broadcast Emails</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compose</CardTitle>
          <CardDescription>Create a draft broadcast email</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                required
              />
            </div>
            <div>
              <Label htmlFor="body">Body</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                required
              />
            </div>
            <div>
              <Label htmlFor="locale">Locale</Label>
              <select
                id="locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="border-input bg-background/60 focus-visible:border-brand-400/60 focus-visible:ring-brand-500/18 ease-smooth w-full rounded-xl border px-3.5 py-2 text-sm backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-4"
              >
                <option value="he">Hebrew (he)</option>
                <option value="en">English (en)</option>
              </select>
            </div>
            {message && <p className="text-sm text-green-600">{message}</p>}
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save draft'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="glass-subtle overflow-hidden rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Past broadcasts</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No broadcasts yet.</p>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Broadcast emails list</caption>
              <thead className="text-muted-foreground text-start text-xs uppercase">
                <tr className="border-border border-b">
                  <th scope="col" className="pb-2 font-medium">
                    Subject
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Locale
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Status
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Recipients
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-accent/40 transition-colors">
                    <td className="py-2">{row.subject}</td>
                    <td className="py-2 uppercase">{row.locale}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.status === 'sent' ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200'}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2">{row.recipientCount ?? '—'}</td>
                    <td className="py-2">
                      {row.status === 'draft' && (
                        <Button size="sm" variant="outline" onClick={() => void handleSend(row.id)}>
                          Send now
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </div>
    </div>
  );
}
