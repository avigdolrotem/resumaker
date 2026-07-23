'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LayoutTemplate, Check, Lock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeatureGate } from '@/lib/hooks/use-feature-gate';
import { UpgradeModal } from '@/components/upgrade-modal';

interface TemplateEntry {
  id: string;
  name: { he: string; en: string };
  description: { he: string; en: string };
  order: number;
  locked: boolean;
}

/**
 * Template picker for the builder's save step. Unlike ModelPicker (a
 * persistent account-level setting), this is per-resume — the caller
 * owns the selected id and passes it straight into POST /api/resumes'
 * `templateId`. Before this component existed, that field was never
 * sent from any client at all, so every resume silently saved under
 * the schema default ('modern') regardless of tier.
 */
export function TemplatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslations('builder.templatePicker');
  const locale = useLocale() as 'he' | 'en';
  const [templates, setTemplates] = useState<TemplateEntry[] | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const gate = useFeatureGate('template_locked', 'plus');

  useEffect(() => {
    let active = true;
    fetch('/api/templates')
      .then((r) => r.json())
      .then((data) => {
        if (active) setTemplates(data.templates ?? []);
      })
      .catch(() => {
        if (active) setTemplates([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!templates || templates.length === 0) return null;

  const current = templates.find((tpl) => tpl.id === value);
  const currentLabel = current?.name[locale] ?? value;

  function pick(tpl: TemplateEntry) {
    if (tpl.locked) {
      setOpen(false);
      gate.show();
      return;
    }
    onChange(tpl.id);
    setOpen(false);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="border-input bg-background/60 hover:bg-accent/40 ease-smooth inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm backdrop-blur-sm transition-all duration-200"
      >
        <LayoutTemplate className="text-brand-500 h-3.5 w-3.5" />
        <span>{t('label')}:</span>
        <span className="max-w-[140px] truncate font-medium">{currentLabel}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="glass-strong animate-liquid-pop absolute start-0 z-50 mt-1 w-72 overflow-hidden rounded-2xl"
        >
          {templates.map((tpl) => {
            const selected = tpl.id === value;
            return (
              <li key={tpl.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => pick(tpl)}
                  className={cn(
                    'ease-smooth flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm transition-colors duration-200',
                    selected
                      ? 'from-brand-500/15 via-brand-500/10 to-brand-500/15 bg-gradient-to-r'
                      : tpl.locked
                        ? 'hover:bg-accent/20 opacity-70'
                        : 'hover:bg-accent/40',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{tpl.name[locale]}</div>
                    <p className="text-muted-foreground line-clamp-1 text-xs">
                      {tpl.description[locale]}
                    </p>
                  </div>
                  {tpl.locked && (
                    <Lock className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
                  )}
                  {selected && <Check className="text-brand-500 h-4 w-4 flex-shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <UpgradeModal
        open={gate.open}
        onOpenChange={gate.setOpen}
        feature="template_locked"
        requiredTier={gate.requiredTier}
      />
    </div>
  );
}
