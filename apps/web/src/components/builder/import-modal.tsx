'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, X, Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiquidSpinner } from '@/components/ui-effects/liquid-spinner';
import { type ParsedImport, type ImportOpts, DEFAULT_OPTS } from '@/lib/builder/apply-import';

/**
 * Multi-step import modal: Upload → Parsing → Preview → Apply.
 *
 * Calls the existing /api/profile/import endpoint. The endpoint returns
 * a flat ParsedProfile shape (name/email at top level), so applying
 * its output goes through `applyImportedProfile` in the parent which
 * handles the per-section merge/replace strategy.
 *
 * The Preview step lets users opt out of any section before applying —
 * useful when the parser misreads something or you only want certs/skills.
 */

type Step = 'upload' | 'parsing' | 'preview' | 'error';

type ImportError =
  { kind: 'rate_limit'; retryAfterSeconds: number } | { kind: 'generic'; message: string };

export interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (profile: ParsedImport, opts: ImportOpts) => void;
}

export function ImportModal({ open, onClose, onApply }: ImportModalProps) {
  const t = useTranslations('builder.import');
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [error, setError] = useState<ImportError | null>(null);
  const [opts, setOpts] = useState<ImportOpts>({ ...DEFAULT_OPTS });
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  async function handleFile(file: File) {
    setStep('parsing');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/profile/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        // Rate-limit gets its own copy — "Couldn't parse the file" is
        // actively misleading here since the file was never even read;
        // the request was rejected before parsing was attempted.
        if (res.status === 429 && typeof data.retryAfterSeconds === 'number') {
          setError({ kind: 'rate_limit', retryAfterSeconds: data.retryAfterSeconds });
        } else {
          setError({ kind: 'generic', message: data.error ?? `Server returned ${res.status}` });
        }
        setStep('error');
        return;
      }
      setParsed(data.profile);
      setStep('preview');
    } catch (e) {
      setError({ kind: 'generic', message: (e as Error).message });
      setStep('error');
    }
  }

  function reset() {
    setStep('upload');
    setParsed(null);
    setError(null);
    setOpts({ ...DEFAULT_OPTS });
  }

  function close() {
    reset();
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('ariaLabel')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong animate-liquid-pop relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl p-6"
      >
        <button
          type="button"
          onClick={close}
          aria-label={t('close')}
          className="text-muted-foreground hover:text-foreground hover:bg-accent/60 ease-snappy absolute end-4 top-4 rounded-full p-1 transition-colors duration-200 active:scale-90"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-1 text-xl font-bold">{t('title')}</h2>
        <p className="text-muted-foreground mb-4 text-sm">{t('subtitle')}</p>

        {step === 'upload' && (
          <div
            role="button"
            tabIndex={0}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
            className="border-border hover:border-brand-300 bg-muted/30 ease-smooth cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors duration-300"
          >
            <Upload className="text-muted-foreground mx-auto h-8 w-8" />
            <p className="text-foreground mt-2 text-sm font-medium">{t('dropTitle')}</p>
            <p className="text-muted-foreground text-xs">{t('dropHint')}</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {step === 'parsing' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <LiquidSpinner size={32} />
            <p className="text-muted-foreground text-sm">{t('parsing')}</p>
            <p className="text-muted-foreground/70 text-xs">{t('parsingHint')}</p>
          </div>
        )}

        {step === 'error' && error && (
          <div className="text-destructive border-destructive/30 bg-destructive/10 rounded-xl border p-3 text-sm">
            <p className="font-medium">
              {error.kind === 'rate_limit' ? t('rateLimitTitle') : t('errorTitle')}
            </p>
            <p className="text-xs">
              {error.kind === 'rate_limit'
                ? t('rateLimitBody', { minutes: Math.ceil(error.retryAfterSeconds / 60) })
                : error.message}
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={reset}>
              {t('tryAgain')}
            </Button>
          </div>
        )}

        {step === 'preview' && parsed && (
          <div className="space-y-4">
            <div className="border-border bg-muted/30 rounded-xl border p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <FileText className="h-3.5 w-3.5" />
                {t('foundTitle')}
              </p>
              <ul className="space-y-1 text-sm">
                {(parsed.name || parsed.email || parsed.phone) && (
                  <PreviewRow
                    ok={opts.contact}
                    onToggle={(v) => setOpts({ ...opts, contact: v })}
                    label={t('labels.contact')}
                    detail={
                      [parsed.name, parsed.email, parsed.phone].filter(Boolean).join(' · ') ||
                      t('detail.empty')
                    }
                  />
                )}
                {parsed.summary && (
                  <PreviewRow
                    ok={opts.summary}
                    onToggle={(v) => setOpts({ ...opts, summary: v })}
                    label={t('labels.summary')}
                    detail={parsed.summary.slice(0, 80) + (parsed.summary.length > 80 ? '…' : '')}
                  />
                )}
                {parsed.experience && parsed.experience.length > 0 && (
                  <PreviewRow
                    ok={opts.experience}
                    onToggle={(v) => setOpts({ ...opts, experience: v })}
                    label={t('labels.experience')}
                    detail={t('detail.experience', {
                      count: parsed.experience.length,
                      names: parsed.experience
                        .map((e) => e.company)
                        .filter(Boolean)
                        .slice(0, 3)
                        .join(', '),
                    })}
                  />
                )}
                {parsed.education && parsed.education.length > 0 && (
                  <PreviewRow
                    ok={opts.education}
                    onToggle={(v) => setOpts({ ...opts, education: v })}
                    label={t('labels.education')}
                    detail={t('detail.education', {
                      count: parsed.education.length,
                      names: parsed.education
                        .map((e) => e.institution)
                        .filter(Boolean)
                        .slice(0, 2)
                        .join(', '),
                    })}
                  />
                )}
                {parsed.projects && parsed.projects.length > 0 && (
                  <PreviewRow
                    ok={opts.projects}
                    onToggle={(v) => setOpts({ ...opts, projects: v })}
                    label={t('labels.projects')}
                    detail={t('detail.count', { count: parsed.projects.length })}
                  />
                )}
                {parsed.skills && parsed.skills.length > 0 && (
                  <PreviewRow
                    ok={opts.skills}
                    onToggle={(v) => setOpts({ ...opts, skills: v })}
                    label={t('labels.skills')}
                    detail={t('detail.skills', { count: parsed.skills.length })}
                  />
                )}
                {parsed.certifications && parsed.certifications.length > 0 && (
                  <PreviewRow
                    ok={opts.certifications}
                    onToggle={(v) => setOpts({ ...opts, certifications: v })}
                    label={t('labels.certifications')}
                    detail={t('detail.count', { count: parsed.certifications.length })}
                  />
                )}
                {parsed.awards && parsed.awards.length > 0 && (
                  <PreviewRow
                    ok={opts.awards}
                    onToggle={(v) => setOpts({ ...opts, awards: v })}
                    label={t('labels.awards')}
                    detail={t('detail.count', { count: parsed.awards.length })}
                  />
                )}
                {parsed.languages && parsed.languages.length > 0 && (
                  <PreviewRow
                    ok={opts.languages}
                    onToggle={(v) => setOpts({ ...opts, languages: v })}
                    label={t('labels.languages')}
                    detail={t('detail.count', { count: parsed.languages.length })}
                  />
                )}
              </ul>
            </div>
            <p className="text-muted-foreground text-xs">{t('strategyNote')}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  onApply(parsed, opts);
                  close();
                }}
              >
                <Check className="me-1 h-3.5 w-3.5" />
                {t('apply')}
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                {t('tryAnother')}
              </Button>
              <Button type="button" variant="ghost" onClick={close}>
                {t('discard')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewRow({
  ok,
  onToggle,
  label,
  detail,
}: {
  ok: boolean;
  onToggle: (v: boolean) => void;
  label: string;
  detail: string;
}) {
  const t = useTranslations('builder.import');
  return (
    <li className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={ok}
        onChange={(e) => onToggle(e.target.checked)}
        className="accent-brand-600 mt-0.5 h-4 w-4 rounded"
        aria-label={t('includeAria', { label })}
      />
      <span>
        <span className="font-medium">{label}:</span>{' '}
        <span className="text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}
