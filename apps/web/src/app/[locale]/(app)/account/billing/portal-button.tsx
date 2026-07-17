'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { LiquidSpinner } from '@/components/ui-effects/liquid-spinner';

/**
 * Opens the Stripe Customer Portal in a new tab. Server-side route
 * creates a one-time portal session URL and we redirect to it.
 */
export function BillingPortalButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = (await res.json()) as { url?: string; error?: string; code?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? 'Failed to open billing portal');
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={() => void openPortal()} disabled={loading}>
      {loading && <LiquidSpinner size={16} />}
      {label}
    </Button>
  );
}
