'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Undo2, Loader2 } from 'lucide-react';

/**
 * Inline "Rewrite with AI" button used next to each highlight bullet
 * in the Experience editor and the Summary card. Calls
 * /api/resumes/bullet/rewrite with optional JD context. Replaces the
 * current value with the AI's version and offers a 30-second Undo.
 */

export interface AiRewriteButtonProps {
  value: string;
  /** JD context — empty string disables tailoring. */
  jobDescription?: string | undefined;
  tone?: 'impact' | 'concise' | 'formal';
  onReplace: (next: string) => void;
}

export function AiRewriteButton({
  value,
  jobDescription = '',
  tone = 'impact',
  onReplace,
}: AiRewriteButtonProps) {
  const t = useTranslations('builder.aiRewrite');
  const [loading, setLoading] = useState(false);
  const [undoValue, setUndoValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/resumes/bullet/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bullet: value,
          ...(jobDescription.trim() && { jobDescription }),
          tone,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { bullet: string };
      setUndoValue(value);
      onReplace(data.bullet);
      // Auto-clear the undo affordance after 30s.
      window.setTimeout(() => setUndoValue(null), 30_000);
    } catch (e) {
      setError((e as Error).message);
      window.setTimeout(() => setError(null), 5_000);
    } finally {
      setLoading(false);
    }
  }

  if (undoValue !== null) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onReplace(undoValue);
          setUndoValue(null);
        }}
        className="text-muted-foreground hover:text-foreground ease-snappy inline-flex items-center gap-1 text-xs transition-colors duration-200"
      >
        <Undo2 className="h-3 w-3" />
        {t('undoRewrite')}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void handleClick();
      }}
      disabled={loading || !value.trim()}
      title={error ?? t('rewriteWithAi')}
      className="text-brand-500 hover:text-brand-700 ease-snappy inline-flex items-center gap-1 text-xs transition-colors duration-200 disabled:opacity-40"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      {loading ? t('rewriting') : error ? t('tryAgain') : t('rewriteWithAi')}
    </button>
  );
}
