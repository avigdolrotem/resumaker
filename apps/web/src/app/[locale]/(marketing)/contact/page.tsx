'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AnimatedMeshBg } from '@/components/ui-effects/animated-mesh-bg';
import { ScrollReveal } from '@/components/scroll-reveal';

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

  // Plain <div>, not <main> — the (marketing) layout already renders
  // <main id="main"> around every page (see layout.tsx); a second one
  // here would be an invalid nested landmark with a duplicate id.
  if (submitted) {
    return (
      <div className="relative overflow-hidden px-4 py-16">
        <AnimatedMeshBg intensity="subtle" className="fixed" />
        <div
          aria-hidden
          className="from-background/40 via-background/70 to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
        />
        <div className="relative mx-auto max-w-2xl">
          <ScrollReveal>
            <Card className="animate-liquid-pop">
              <CardContent className="space-y-3 py-12 text-center">
                <h1 className="text-2xl font-bold">
                  {locale === 'he'
                    ? 'תודה — נחזור אליך תוך 24 שעות'
                    : "Thanks — we'll reply within 24h"}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {locale === 'he'
                    ? 'הפנייה נשמרה ונשלחה לצוות התמיכה.'
                    : 'Your message has been logged and forwarded to our support team.'}
                </p>
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden px-4 py-12">
      <AnimatedMeshBg intensity="subtle" className="fixed" />
      <div
        aria-hidden
        className="from-background/40 via-background/70 to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
      />
      <div className="relative mx-auto max-w-2xl">
        <ScrollReveal>
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              {locale === 'he' ? 'צור קשר' : 'Contact us'}
            </h1>
            <p className="text-muted-foreground mt-4 text-lg">
              {locale === 'he'
                ? 'יש לך שאלה, בקשת פיצ׳ר, או שמשהו לא עובד? ספר לנו.'
                : 'Got a question, feature request, or bug to report? We listen.'}
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <Card className="animate-liquid-pop">
            <CardContent className="pt-6">
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
        </ScrollReveal>
      </div>
    </div>
  );
}
