'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Copy, Check, Mail, Share2, Gift, Users } from 'lucide-react';
import { toast } from 'sonner';

interface ReferralData {
  code: string;
  usageCount: number;
  referredCount: number;
  qualifiedCount: number;
}

export default function ReferralPage() {
  const t = useTranslations('referral');
  const locale = useLocale();
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/referrals/me')
      .then((r) => r.json())
      .then((d: ReferralData) => setData(d))
      .catch(() => toast.error(t('loadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const refLink = data ? `${appUrl}/${locale}/sign-up?ref=${data.code}` : '';

  async function handleCopy() {
    if (!refLink) return;
    await navigator.clipboard.writeText(refLink);
    setCopied(true);
    toast.success(t('linkCopied'));
    setTimeout(() => setCopied(false), 2000);
  }

  function handleEmail() {
    const subject = encodeURIComponent(t('emailSubject'));
    const body = encodeURIComponent(`${t('emailBody')}\n\n${refLink}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }

  function handleWhatsApp() {
    const text = encodeURIComponent(`${t('whatsappText')} ${refLink}`);
    window.open(`https://wa.me/?text=${text}`);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">{t('loading')}</div>
      </main>
    );
  }

  return (
    <main id="main" className="bg-muted min-h-screen py-12">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg">
            <Gift className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-3">{t('subtitle')}</p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="border-border bg-card rounded-xl border p-6 text-center shadow-sm">
            <div className="text-muted-foreground flex items-center justify-center gap-2">
              <Users className="h-4 w-4" />
              <span className="text-sm">{t('stats.referred')}</span>
            </div>
            <div className="text-foreground mt-2 text-3xl font-bold">
              {data?.referredCount ?? 0}
            </div>
          </div>
          <div className="border-border bg-card rounded-xl border p-6 text-center shadow-sm">
            <div className="text-muted-foreground flex items-center justify-center gap-2">
              <Check className="h-4 w-4" />
              <span className="text-sm">{t('stats.qualified')}</span>
            </div>
            <div className="mt-2 text-3xl font-bold text-emerald-600">
              {data?.qualifiedCount ?? 0}
            </div>
          </div>
        </div>

        {/* Share card */}
        <div className="border-border bg-card rounded-2xl border p-8 shadow-sm">
          <h2 className="mb-4 font-semibold">{t('yourCode')}</h2>

          {data && (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="border-border bg-muted text-foreground flex-1 rounded-lg border px-4 py-3 font-mono text-lg font-bold tracking-widest">
                  {data.code}
                </div>
                <button
                  onClick={handleCopy}
                  className="border-border bg-card text-muted-foreground hover:bg-accent flex h-11 w-11 items-center justify-center rounded-lg border transition"
                  aria-label={t('copy')}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>

              <p className="text-muted-foreground mb-4 text-sm">{t('linkLabel')}</p>
              <div className="border-border bg-muted text-muted-foreground mb-6 break-all rounded-lg border px-3 py-2 text-xs">
                {refLink}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleCopy}
                  className="border-border bg-card text-foreground hover:bg-accent flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition"
                >
                  <Copy className="h-4 w-4" />
                  {t('copyLink')}
                </button>
                <button
                  onClick={handleEmail}
                  className="border-border bg-card text-foreground hover:bg-accent flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition"
                >
                  <Mail className="h-4 w-4" />
                  {t('shareEmail')}
                </button>
                <button
                  onClick={handleWhatsApp}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
                >
                  <Share2 className="h-4 w-4" />
                  WhatsApp
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
