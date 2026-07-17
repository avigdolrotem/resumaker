import { useTranslations } from 'next-intl';
import { LiquidSpinner } from '@/components/ui-effects/liquid-spinner';

export default function MarketingLoading() {
  const t = useTranslations('common');
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <LiquidSpinner size={48} className="mx-auto mb-6" />
      <p className="text-muted-foreground">{t('loading')}</p>
    </div>
  );
}
