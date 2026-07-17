'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Check, Lock, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { MODEL_CATALOG, getModelById, type CatalogEntry } from '@/lib/llm/models';
import type { Tier } from '@/lib/billing/limits';
import { cn } from '@/lib/utils';
import { useFeatureGate } from '@/lib/hooks/use-feature-gate';
import { UpgradeModal } from '@/components/upgrade-modal';

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

  // Note: we no longer hide for free tier — the picker is always
  // visible so users discover Plus/Pro models. Locked entries open the
  // upgrade modal on click. `useFeatureGate` is called unconditionally
  // (rules-of-hooks) and is a cheap pure-client check.
  // Picker requires `plus` minimum (any non-free tier unlocks model
  // choice; individual models still gate on their own minTier).
  const gate = useFeatureGate('model_choice', 'plus');

  if (!state) return null;

  const current = state.llmModel ? getModelById(state.llmModel) : undefined;
  const currentLabel = current?.displayName ?? t('defaultLabel');

  async function pick(model: CatalogEntry) {
    if (!state) return;
    if (tierOrder[state.tier] < tierOrder[model.minTier]) {
      // Locked model — open the upgrade modal instead of silently
      // rejecting. Server still enforces; this is UX.
      setOpen(false);
      gate.show();
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
        className="glass hover:glass-strong ease-snappy inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition-all duration-200 active:scale-[0.96]"
      >
        <Sparkles className="text-brand-500 h-3.5 w-3.5" />
        <span className="max-w-[140px] truncate">{currentLabel}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="glass-strong animate-liquid-pop absolute end-0 z-50 mt-1 w-72 overflow-hidden rounded-2xl"
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
                  onClick={() => pick(m)}
                  disabled={saving === m.id}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm transition',
                    selected
                      ? 'bg-brand-50 dark:bg-brand-900/30'
                      : allowed
                        ? 'hover:bg-muted'
                        : 'hover:bg-muted/60 opacity-70',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      {m.displayName}
                      {m.recommended && (
                        <span className="bg-brand-500 rounded-full px-1.5 py-0 text-[10px] text-white">
                          {t('recommended')}
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
      <UpgradeModal
        open={gate.open}
        onOpenChange={gate.setOpen}
        feature="model_choice"
        requiredTier={gate.requiredTier}
      />
    </div>
  );
}
