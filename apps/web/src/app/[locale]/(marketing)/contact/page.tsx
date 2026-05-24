'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

/**
 * /[locale]/contact — public contact form.
 *
 * Posts to /api/support/contact (rate-limited 5/hour per IP) — open to
 * anonymous and authenticated users. Submission stores a row in
 * support_tickets and emails support@resumaker.co.il.
 */
export default function ContactPage() {
  const params = useParams();
  const locale = (params?.['locale'] === 'he' ? 'he' : 'en') as 'he' | 'en';

  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? (locale === 'he' ? 'שליחה נכשלה' : 'Send failed'));
        return;
      }
      setSubmitted(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <Card>
          <CardContent className="space-y-3 py-12 text-center">
            <h1 className="text-2xl font-bold">
              {locale === 'he'
                ? 'תודה — נחזור אליך תוך 24 שעות'
                : "Thanks — we'll reply within 24h"}
            </h1>
            <p className="text-sm text-neutral-600">
              {locale === 'he'
                ? 'הפנייה נשמרה ונשלחה לצוות התמיכה.'
                : 'Your message has been logged and forwarded to our support team.'}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>{locale === 'he' ? 'צור קשר' : 'Contact us'}</CardTitle>
          <CardDescription>
            {locale === 'he'
              ? 'יש לך שאלה, בקשת פיצ׳ר, או שמשהו לא עובד? ספר לנו.'
              : 'Got a question, feature request, or bug to report? We listen.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{locale === 'he' ? 'אימייל' : 'Your email'}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">{locale === 'he' ? 'נושא' : 'Subject'}</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                minLength={3}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">{locale === 'he' ? 'הודעה' : 'Message'}</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                minLength={10}
                maxLength={5000}
                rows={8}
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              <Send className="me-2 h-4 w-4" />
              {submitting
                ? locale === 'he'
                  ? 'שולח…'
                  : 'Sending…'
                : locale === 'he'
                  ? 'שלח הודעה'
                  : 'Send message'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
