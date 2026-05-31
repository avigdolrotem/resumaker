'use client';

import type { Resume } from '@resumaker/shared';
import { useTranslations } from 'next-intl';
import { User, Mail, Phone, MapPin, Linkedin, Github, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionCard } from '../section-card';

type T = ReturnType<typeof useTranslations>;

/** Contact card — single SectionCard with all contact fields. */

type Contact = Resume['contact'];

export interface ContactCardProps {
  contact: Contact;
  onChange: (next: Contact) => void;
  editingId: string | null;
  onSetEditingId: (id: string | null) => void;
}

const CARD_ID = 'contact';

export function ContactCard({ contact, onChange, editingId, onSetEditingId }: ContactCardProps) {
  const t = useTranslations('builder.sections.contact');
  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-foreground flex items-center gap-2 text-lg font-bold">
          <User className="text-brand-500 h-4 w-4" />
          {t('heading')}
        </h2>
      </header>
      <SectionCard
        data={contact}
        isEditing={editingId === CARD_ID}
        onEnterEdit={() => onSetEditingId(CARD_ID)}
        onSave={(next) => {
          onChange(next);
          onSetEditingId(null);
        }}
        onCancel={() => onSetEditingId(null)}
        onDelete={() => {
          // Contact can't be deleted — reset to a minimal valid value instead.
          onChange({ name: contact.name });
          onSetEditingId(null);
        }}
        renderRead={(c) => readContact(c, t)}
        renderEdit={(c, onChangeDraft) => editContact(c, onChangeDraft, t)}
        deleteConfirmText={t('resetConfirm')}
      />
    </section>
  );
}

function readContact(c: Contact, t: T) {
  return (
    <div>
      <p className="text-foreground text-lg font-semibold">{c.name || t('namePlaceholder')}</p>
      {(c.email || c.phone || c.location) && (
        <p className="text-muted-foreground mt-0.5 text-sm">
          {[c.email, c.phone, c.location].filter(Boolean).join(' · ')}
        </p>
      )}
      {(c.linkedin || c.github || c.website) && (
        <div className="text-muted-foreground mt-1 flex flex-wrap gap-3 text-xs">
          {c.linkedin && (
            <span className="inline-flex items-center gap-1">
              <Linkedin className="h-3 w-3" />
              {t('links.linkedin')}
            </span>
          )}
          {c.github && (
            <span className="inline-flex items-center gap-1">
              <Github className="h-3 w-3" />
              {t('links.github')}
            </span>
          )}
          {c.website && (
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {t('links.website')}
            </span>
          )}
        </div>
      )}
    </div>
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
