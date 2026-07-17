'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Sparkles, Check, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MODEL_CATALOG, type CatalogEntry } from '@/lib/llm/models';
import type { Tier } from '@/lib/billing/limits';
import { cn } from '@/lib/utils';

interface ServerState {
  llmModel: string | null;
  tier: Tier;
}

const tierOrder = { free: 0, plus: 1, pro: 2 } as const;

export function AIModelCard() {
  const t = useTranslations('settings.ai');
  const [state, setState] = useState<ServerState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {MODEL_CATALOG.map((m) => {
            const allowed = state ? tierOrder[state.tier] >= tierOrder[m.minTier] : false;
            const selected = state?.llmModel === m.id;
            const isRecommendedDefault =
              !state?.llmModel && m.recommended && state?.tier !== 'free';
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => allowed && pick(m)}
                disabled={!allowed || saving === m.id}
                className={cn(
                  'ease-smooth relative rounded-2xl border p-4 text-left transition-all duration-300 active:scale-[0.98]',
                  selected || isRecommendedDefault
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                    : 'border-border hover:border-brand-300 hover:-translate-y-0.5',
                  !allowed && 'cursor-not-allowed opacity-50 active:scale-100',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{m.displayName}</div>
                  <div className="flex items-center gap-1.5">
                    {m.recommended && (
                      <span className="bg-brand-500 rounded-full px-2 py-0.5 text-xs text-white">
                        {t('recommended')}
                      </span>
                    )}
                    {!allowed && <Lock className="text-muted-foreground h-3.5 w-3.5" />}
                    {selected && <Check className="text-brand-500 h-4 w-4" />}
                  </div>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{m.blurbEn}</p>
                {!allowed && <p className="text-muted-foreground mt-2 text-xs">{t('locked')}</p>}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
