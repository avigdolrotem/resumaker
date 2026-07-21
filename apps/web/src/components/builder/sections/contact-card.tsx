'use client';

import type { ProfileContent } from '@resumaker/shared';
import { useTranslations } from 'next-intl';
import { User, Mail, Phone, MapPin, Linkedin, Github, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

type T = ReturnType<typeof useTranslations>;

/**
 * Contact card — always shows the editable form directly, unlike every
 * other section here (which default to a compact read view behind a
 * SectionCard's click-to-expand). Contact is the first thing anyone
 * fills in — on the onboarding wizard's own dedicated step, and again
 * at the top of the always-visible profile page — so hiding it behind
 * an extra click just adds friction to the one section that's never
 * actually optional.
 */

type Contact = ProfileContent['contact'];

export interface ContactCardProps {
  contact: Contact;
  onChange: (next: Contact) => void;
}

export function ContactCard({ contact, onChange }: ContactCardProps) {
  const t = useTranslations('builder.sections.contact');
  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-foreground flex items-center gap-2 text-lg font-bold">
          <User className="text-brand-500 h-4 w-4" />
          {t('heading')}
        </h2>
      </header>
      <Card interactive={false}>
        <CardHeader className="sr-only">{t('heading')}</CardHeader>
        <CardContent className="pt-6">{editContact(contact, onChange, t)}</CardContent>
      </Card>
    </section>
  );
}

function editContact(c: Contact, onChange: (next: Contact) => void, t: T) {
  const set = <K extends keyof Contact>(k: K, v: Contact[K]) => onChange({ ...c, [k]: v });
  const setOpt = <K extends keyof Contact>(k: K, v: string) =>
    onChange({ ...c, [k]: (v || undefined) as Contact[K] });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="contact-name">{t('fields.name')} *</Label>
        <Input
          id="contact-name"
          value={c.name}
          onChange={(ev) => set('name', ev.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="contact-email">
          <Mail className="me-1 inline h-3 w-3" /> {t('fields.email')}
        </Label>
        <Input
          id="contact-email"
          type="email"
          value={c.email ?? ''}
          onChange={(ev) => setOpt('email', ev.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="contact-phone">
          <Phone className="me-1 inline h-3 w-3" /> {t('fields.phone')}
        </Label>
        <Input
          id="contact-phone"
          type="tel"
          value={c.phone ?? ''}
          onChange={(ev) => setOpt('phone', ev.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="contact-location">
          <MapPin className="me-1 inline h-3 w-3" /> {t('fields.location')}
        </Label>
        <Input
          id="contact-location"
          value={c.location ?? ''}
          onChange={(ev) => setOpt('location', ev.target.value)}
          placeholder={t('placeholders.location')}
        />
      </div>
      <div>
        <Label htmlFor="contact-linkedin">
          <Linkedin className="me-1 inline h-3 w-3" /> {t('fields.linkedin')}
        </Label>
        <Input
          id="contact-linkedin"
          type="url"
          value={c.linkedin ?? ''}
          onChange={(ev) => setOpt('linkedin', ev.target.value)}
          placeholder={t('placeholders.linkedin')}
        />
      </div>
      <div>
        <Label htmlFor="contact-github">
          <Github className="me-1 inline h-3 w-3" /> {t('fields.github')}
        </Label>
        <Input
          id="contact-github"
          type="url"
          value={c.github ?? ''}
          onChange={(ev) => setOpt('github', ev.target.value)}
          placeholder={t('placeholders.github')}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="contact-website">
          <Globe className="me-1 inline h-3 w-3" /> {t('fields.website')}
        </Label>
        <Input
          id="contact-website"
          type="url"
          value={c.website ?? ''}
          onChange={(ev) => setOpt('website', ev.target.value)}
        />
      </div>
    </div>
  );
}
