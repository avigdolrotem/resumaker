'use client';

/**
 * TemplatePicker — visual chooser shown in the builder.
 *
 * Three templates ship today (modern, classic, minimal). Free tier can
 * use modern only; Plus + Pro unlock the rest. Locked tiles render
 * grayscale with a small lock icon + "Plus" tag; clicking them shows
 * the upgrade CTA inline (no modal, no page jump).
 *
 * Hebrew users get Hebrew labels via the `templates.*` namespace.
 */

import { useTranslations } from 'next-intl';
import { Check, Lock } from 'lucide-react';
import type { Tier } from '@/lib/billing/limits';

export type TemplateId = 'modern' | 'classic' | 'minimal';

interface Template {
  id: TemplateId;
  /** Minimum tier required to select this template */
  minTier: Tier;
}

const TEMPLATES: Template[] = [
  { id: 'modern', minTier: 'free' },
  { id: 'classic', minTier: 'plus' },
  { id: 'minimal', minTier: 'plus' },
];

const TIER_RANK: Record<Tier, number> = { free: 0, plus: 1, pro: 2 };

interface Props {
  value: TemplateId;
  onChange: (next: TemplateId) => void;
  userTier: Tier;
}

export function TemplatePicker({ value, onChange, userTier }: Props) {
  const t = useTranslations('templates');
  return (
    <div className="grid grid-cols-3 gap-3">
      {TEMPLATES.map((tpl) => {
        const locked = TIER_RANK[userTier] < TIER_RANK[tpl.minTier];
        const selected = value === tpl.id;
        return (
          <button
            type="button"
            key={tpl.id}
            disabled={locked}
            onClick={() => !locked && onChange(tpl.id)}
            aria-pressed={selected}
            aria-label={t(`${tpl.id}.name`)}
            className={[
              'group relative aspect-[3/4] overflow-hidden rounded-lg border-2 transition',
              selected
                ? 'border-violet-600 ring-2 ring-violet-200'
                : 'border-neutral-200 hover:border-violet-400',
              locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            ].join(' ')}
          >
            <TemplatePreview id={tpl.id} />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
              <p className="text-xs font-semibold text-white">{t(`${tpl.id}.name`)}</p>
              <p className="text-[10px] text-white/80">{t(`${tpl.id}.subtitle`)}</p>
            </div>
            {selected && (
              <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white">
                <Check className="h-3.5 w-3.5" />
              </span>
            )}
            {locked && (
              <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-neutral-900/80 px-2 py-0.5 text-[10px] font-medium text-white">
                <Lock className="h-3 w-3" />
                {tpl.minTier === 'plus' ? 'Plus' : 'Pro'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Tiny inline preview — abstract SVG, not a real PDF render. Real preview
 * would need to spin up @react-pdf/renderer in the client which is heavy.
 * Goal here is "user can tell modern from classic from minimal at a glance",
 * not a pixel-accurate render.
 */
function TemplatePreview({ id }: { id: TemplateId }) {
  const palette: Record<TemplateId, { bar: string; text: string; bg: string }> = {
    modern: { bar: '#6d28d9', text: '#1f2937', bg: '#ffffff' },
    classic: { bar: '#1f2937', text: '#374151', bg: '#fdfdfd' },
    minimal: { bar: '#d4d4d8', text: '#52525b', bg: '#fafafa' },
  };
  const p = palette[id];
  return (
    <svg viewBox="0 0 120 160" className="h-full w-full" style={{ background: p.bg }}>
      {/* Header band */}
      <rect
        x={10}
        y={12}
        width={100}
        height={id === 'modern' ? 14 : id === 'classic' ? 1 : 0}
        fill={p.bar}
      />
      <rect
        x={10}
        y={id === 'modern' ? 30 : 18}
        width={70}
        height={5}
        fill={p.text}
        opacity={0.9}
      />
      <rect
        x={10}
        y={id === 'modern' ? 38 : 26}
        width={40}
        height={2.5}
        fill={p.text}
        opacity={0.5}
      />
      {/* Section blocks */}
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(0 ${52 + i * 28})`}>
          <rect x={10} y={0} width={28} height={3} fill={p.bar} opacity={0.7} />
          <rect x={10} y={7} width={100} height={2} fill={p.text} opacity={0.3} />
          <rect x={10} y={12} width={95} height={2} fill={p.text} opacity={0.3} />
          <rect x={10} y={17} width={80} height={2} fill={p.text} opacity={0.3} />
        </g>
      ))}
    </svg>
  );
}
