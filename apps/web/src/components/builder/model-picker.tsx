'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Check, Lock, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { MODEL_CATALOG, getModelById, type CatalogEntry } from '@/lib/llm/models';
import type { Tier } from '@/lib/billing/limits';
import { cn } from '@/lib/utils';

interface ServerState {
  llmModel: string | null;
  tier: Tier;
}

const tierOrder = { free: 0, plus: 1, pro: 2 } as const;

/**
 * Compact model picker for the builder header. Reuses the same
 * GET/PATCH /api/user/llm-model endpoint as the full settings card,
 * so a change here persists across resumes and is reflected on the
 * settings page.
 *
 * Hidden entirely for users whose tier can't choose a model (free).
 * Renders as a small dropdown next to the page title — minimal vertical
 * space, no extra row of UI on mobile.
 */
export function ModelPicker() {
  const t = useTranslations('settings.ai');
  const [state, setState] = useState<ServerState | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/user/llm-model')
      .then((r) => r.json())
      .then((data) => {
        if (active) setState(data as ServerState);
      })
      .catch(() => {
        if (active) setState({ llmModel: null, tier: 'free' });
      });
    return () => {
      active = false;
    };
  }, []);

  // Close on outside click + Escape.
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

  if (!state) return null;
  // Free tier can't choose — hide entirely. The picker would just be
  // locked icons across the board, which is noise rather than UX.
  if (state.tier === 'free') return null;

  const current = state.llmModel ? getModelById(state.llmModel) : undefined;
  const currentLabel = current?.displayName ?? t('defaultLabel', { defaultValue: 'Default model' });

  async function pick(model: CatalogEntry) {
    if (!state) return;
    if (tierOrder[state.tier] < tierOrder[model.minTier]) {
      toast.error(t('locked'));
      return;
    }
    setSaving(model.id);
    try {
      const res = await fetch('/api/user/llm-model', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ llmModel: model.id }),
      });
      if (res.ok) {
        setState({ ...state, llmModel: model.id });
        setOpen(false);
        toast.success(t('saved'));
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? 'Failed to save');
      }
    } finally {
      setSaving(null);
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="border-border bg-card hover:border-brand-300 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition"
      >
        <Sparkles className="text-brand-500 h-3.5 w-3.5" />
        <span className="max-w-[140px] truncate">{currentLabel}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="border-border bg-card absolute end-0 z-50 mt-1 w-72 overflow-hidden rounded-md border shadow-lg"
        >
          {MODEL_CATALOG.map((m) => {
            const allowed = tierOrder[state.tier] >= tierOrder[m.minTier];
            const selected = state.llmModel === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => allowed && pick(m)}
                  disabled={!allowed || saving === m.id}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm transition',
                    selected
                      ? 'bg-brand-50 dark:bg-brand-900/30'
                      : allowed
                        ? 'hover:bg-muted'
                        : 'cursor-not-allowed opacity-50',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      {m.displayName}
                      {m.recommended && (
                        <span className="bg-brand-500 rounded-full px-1.5 py-0 text-[10px] text-white">
                          {t('recommended', { defaultValue: 'Recommended' })}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground line-clamp-1 text-xs">{m.blurbEn}</p>
                  </div>
                  {!allowed && <Lock className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />}
                  {selected && <Check className="text-brand-500 h-4 w-4 flex-shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
