/**
 * /billing/success — post-checkout landing page.
 *
 * Stripe redirects here after a successful Checkout session. The
 * actual subscription state is set asynchronously by the webhook,
 * so this page just thanks the user and links back to the dashboard.
 * No critical logic should depend on this route being hit.
 */

import { getTranslations } from 'next-intl/server';
import { CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function BillingSuccessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'billing.success' });

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="animate-liquid-pop mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      </div>
      <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
      <p className="text-muted-foreground mt-3 max-w-md text-lg">{t('subtitle')}</p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/dashboard">{t('cta')}</Link>
      </Button>
    </div>
  );
}
