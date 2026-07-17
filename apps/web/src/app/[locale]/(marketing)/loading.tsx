import { LiquidSpinner } from '@/components/ui-effects/liquid-spinner';

export default function MarketingLoading() {
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <LiquidSpinner size={48} className="mx-auto mb-6" />
      <p className="text-muted-foreground">Loading…</p>
    </div>
  );
}
