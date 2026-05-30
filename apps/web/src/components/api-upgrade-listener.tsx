'use client';

import { useEffect, useState } from 'react';
import { API_GATE_EVENT, type ApiGateDetail } from '@/lib/api-client';
import { UpgradeModal } from '@/components/upgrade-modal';

/**
 * Mounted once in the (app) layout. Listens for the `apiclient:402`
 * CustomEvent that `apiFetch` dispatches when the server returns
 * `Payment Required`, and opens the existing `UpgradeModal` with the
 * resolved feature + required tier.
 *
 * Centralising the modal here means individual call sites don't have to
 * own modal state, render the component, or wire up their own
 * upgrade-flow telemetry — they just `await apiFetch(...)` and catch
 * `ApiTierError`.
 */
export function ApiUpgradeListener() {
  const [state, setState] = useState<ApiGateDetail | null>(null);

  useEffect(() => {
    function onGate(e: Event) {
      const detail = (e as CustomEvent<ApiGateDetail>).detail;
      if (detail) setState(detail);
    }
    window.addEventListener(API_GATE_EVENT, onGate);
    return () => window.removeEventListener(API_GATE_EVENT, onGate);
  }, []);

  // Always render the modal (closed when state is null) so its DOM
  // node + focus trap are stable across opens. UpgradeModal portals
  // itself, so its render-when-open contract is handled internally.
  return (
    <UpgradeModal
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) setState(null);
      }}
      feature={state?.feature ?? 'resume_limit'}
      requiredTier={state?.requiredTier ?? 'plus'}
    />
  );
}
