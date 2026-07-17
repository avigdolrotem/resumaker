'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Copy, Check, Mail, Share2, Gift, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LiquidSpinner } from '@/components/ui-effects/liquid-spinner';

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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <LiquidSpinner size={32} />
          <p className="text-muted-foreground text-sm">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <div className="animate-liquid-pop mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/30">
          <Gift className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-3">{t('subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-muted-foreground flex items-center justify-center gap-2">
              <Users className="h-4 w-4" />
              <span className="text-sm">{t('stats.referred')}</span>
            </div>
            <div className="text-foreground mt-2 text-3xl font-bold">
              {data?.referredCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-muted-foreground flex items-center justify-center gap-2">
              <Check className="h-4 w-4" />
              <span className="text-sm">{t('stats.qualified')}</span>
            </div>
            <div className="mt-2 text-3xl font-bold text-emerald-600">
              {data?.qualifiedCount ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Share card */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 font-semibold">{t('yourCode')}</h2>

          {data && (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="border-border bg-muted/60 text-foreground flex-1 rounded-xl border px-4 py-3 font-mono text-lg font-bold tracking-widest backdrop-blur-sm">
                  {data.code}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  aria-label={t('copy')}
                  className="h-11 w-11 shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <p className="text-muted-foreground mb-4 text-sm">{t('linkLabel')}</p>
              <div className="border-border bg-muted/60 text-muted-foreground mb-6 break-all rounded-xl border px-3 py-2 text-xs backdrop-blur-sm">
                {refLink}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={handleCopy}>
                  <Copy className="me-2 h-4 w-4" />
                  {t('copyLink')}
                </Button>
                <Button type="button" variant="outline" onClick={handleEmail}>
                  <Mail className="me-2 h-4 w-4" />
                  {t('shareEmail')}
                </Button>
                <Button
                  type="button"
                  onClick={handleWhatsApp}
                  className="bg-gradient-to-br from-green-500 to-green-700 shadow-green-500/30 hover:shadow-green-500/45"
                >
                  <Share2 className="me-2 h-4 w-4" />
                  WhatsApp
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
