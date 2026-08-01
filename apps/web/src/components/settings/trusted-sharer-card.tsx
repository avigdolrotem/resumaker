'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/format-date';

interface TrustedSharerRequest {
  id: string;
  note: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
}

interface ServerState {
  trusted: boolean;
  requests: TrustedSharerRequest[];
}

/**
 * /settings — "Trusted sharer" tab. See lib/content-trust.ts: a trusted
 * user's manually-imported jobs publish to the shared feed immediately
 * instead of sitting in /admin/moderation until reviewed. role='hr' and
 * role='admin' already get this for free — this card is specifically
 * for a regular job-seeker who wants the same without creating a
 * company (which wouldn't even make sense for them).
 */
export function TrustedSharerCard() {
  const params = useParams();
  const isHe = params?.['locale'] === 'he';
  const [state, setState] = useState<ServerState | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch('/api/trusted-sharer/request')
      .then((r) => r.json())
      .then((data: ServerState) => setState(data))
      .catch(() => setState({ trusted: false, requests: [] }));
  }

  useEffect(load, []);

  async function submit() {
    if (note.trim().length < 20) {
      toast.error(isHe ? 'נא לכתוב לפחות 20 תווים' : 'Write at least 20 characters');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/trusted-sharer/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? (isHe ? 'הבקשה נכשלה' : 'Request failed'));
        return;
      }
      toast.success(isHe ? 'הבקשה נשלחה' : 'Request submitted');
      setNote('');
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!state) return null;

  const pending = state.requests.find((r) => r.status === 'pending');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="text-brand-500 h-5 w-5" />
          {isHe ? 'משתף מהימן' : 'Trusted sharer'}
        </CardTitle>
        <CardDescription>
          {isHe
            ? 'משרות שאתם מוסיפים דרך "הוסף משרה" מוצגות לכל המשתמשים רק אחרי בדיקה קצרה. משתף מהימן מדלג על הבדיקה — המשרות שלכם מתפרסמות מיד.'
            : 'Jobs you add via "Add a job" show to everyone only after a quick review. A trusted sharer skips that — your imports publish immediately.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.trusted ? (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {isHe ? '✓ אתם כבר משתף מהימן.' : "✓ You're already a trusted sharer."}
          </p>
        ) : pending ? (
          <p className="text-muted-foreground text-sm">
            {isHe ? 'הבקשה שלכם ממתינה לבדיקה.' : 'Your request is pending review.'}
          </p>
        ) : (
          <>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder={
                isHe
                  ? 'למה כדאי לסמוך עלינו? למשל: תפקיד, קהילה שאתם חלק ממנה, קישור לפרופיל ציבורי...'
                  : "Why should we trust you? e.g. your role, a community you're part of, a link to a public profile..."
              }
            />
            <Button onClick={submit} disabled={submitting}>
              {submitting ? (isHe ? 'שולח…' : 'Submitting…') : isHe ? 'שלח בקשה' : 'Submit request'}
            </Button>
          </>
        )}

        {state.requests.length > 0 && (
          <div className="border-border space-y-2 border-t pt-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              {isHe ? 'היסטוריית בקשות' : 'Request history'}
            </p>
            {state.requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatDate(r.createdAt, isHe ? 'he' : 'en')}
                </span>
                <span
                  className={
                    r.status === 'approved'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : r.status === 'denied'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground'
                  }
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
