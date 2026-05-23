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

export const dynamic = 'force-dynamic';

export default async function BillingSuccessPage({
  params,
}: {
  params: Promise<{ locale: 'he' | 'en' }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'billing.success' });

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <CheckCircle2 className="mb-6 h-16 w-16 text-emerald-500" />
      <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
      <p className="text-muted-foreground mt-3 max-w-md text-lg">{t('subtitle')}</p>
      <Link
        href="/dashboard"
        className="bg-brand-600 hover:bg-brand-700 mt-8 inline-flex items-center rounded-lg px-6 py-2.5 text-sm font-medium text-white transition"
      >
        {t('cta')}
      </Link>
    </main>
  );
}
