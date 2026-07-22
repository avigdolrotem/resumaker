'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import type { ProfileContent } from '@resumaker/shared';
import { Button } from '@/components/ui/button';
import { LiquidSpinner } from '@/components/ui-effects/liquid-spinner';
import { ProfileEditor } from '@/components/profile/profile-editor';
import { ImportModal } from '@/components/builder/import-modal';
import { applyImportedProfile } from '@/lib/builder/apply-import';

const EMPTY_CONTENT: ProfileContent = {
  contact: { name: '' },
  summary: '',
  experience: [],
  education: [],
  skills: [],
};

export function CareerProfileClient() {
  const t = useTranslations('careerProfile');
  const [content, setContent] = useState<ProfileContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) return;
        const data = await res.json();
        setContent(data.content ?? EMPTY_CONTENT);
      } catch {
        setContent(EMPTY_CONTENT);
      }
    })();
  }, []);

  // Every field fires save() on every keystroke (no debounce), so an
  // older request can resolve after a newer one. Without this guard, a
  // stale failure could flash an error toast for a save a newer,
  // already-successful request has since superseded.
  const saveSeq = useRef(0);

  async function save(next: ProfileContent) {
    setContent(next);
    setSaving(true);
    const mySeq = ++saveSeq.current;
    const isLatest = () => mySeq === saveSeq.current;
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok && isLatest()) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? t('saveFailed'));
      }
    } catch (err) {
      if (isLatest()) toast.error((err as Error).message);
    } finally {
      if (isLatest()) setSaving(false);
    }
  }

  if (!content) {
    return (
      <div className="flex justify-center py-24">
        <LiquidSpinner size={32} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <LiquidSpinner size={14} />
              {t('saving')}
            </span>
          )}
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="me-1.5 h-3.5 w-3.5" />
            {t('import')}
          </Button>
        </div>
      </div>

      <ProfileEditor content={content} onChange={(next) => void save(next)} />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onApply={(profile, opts) => void save(applyImportedProfile(content, profile, opts))}
      />
    </div>
  );
}
