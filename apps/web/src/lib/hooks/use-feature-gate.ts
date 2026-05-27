'use client';

import { useCallback, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import type { FeatureGateName } from '@/components/upgrade-modal';

type Tier = 'free' | 'plus' | 'pro';
const TIER_ORDER: Record<Tier, number> = { free: 0, plus: 1, pro: 2 };

/**
 * Centralised premium-gate hook for client components.
 *
 *   const gate = useFeatureGate('model_choice', 'plus');
 *
 *   <Button
 *     onClick={() => {
 *       if (!gate.checkAccess()) return;       // shows modal if gated
 *       doTheThing();                          // only runs when allowed
 *     }}
 *   />
 *   <gate.Modal />
 *
 * Admin users always pass the gate (role==='admin' → effective tier
 * 'pro' everywhere; see apps/web/src/lib/billing/tier.ts).
 *
 * NOTE: this is UX only. Server routes MUST do their own gate check
 * (`canCreateResume`, `canChooseLLM`, etc) — never trust the client.
 */
export function useFeatureGate(feature: FeatureGateName, requiredTier: 'plus' | 'pro') {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  // Better Auth doesn't surface `role` to the client by default —
  // cast locally. Admin shortcuts every gate; see grant-admin.sh and
  // getUserTier()/effectiveTier() server-side.
  const role = (session?.user as { role?: string } | undefined)?.role;
  // Tier isn't on the client session either; fall back to 'free' and
  // let the server reject if the user IS gated. This means free + plus
  // users see the modal even if the server would have allowed them —
  // acceptable cost for not needing to fetch the tier client-side on
  // every render. We can promote tier to the session in a follow-up.
  const tier: Tier =
    role === 'admin' ? 'pro' : ((session?.user as { tier?: Tier } | undefined)?.tier ?? 'free');

  const hasAccess = TIER_ORDER[tier] >= TIER_ORDER[requiredTier];

  /** Returns true if the action should proceed, false if the modal opened instead. */
  const checkAccess = useCallback(() => {
    if (hasAccess) return true;
    setOpen(true);
    return false;
  }, [hasAccess]);

  return {
    hasAccess,
    checkAccess,
    /** Imperative — opens the modal regardless. Useful for "info" CTAs on locked items. */
    show: () => setOpen(true),
    open,
    setOpen,
    requiredTier,
    feature,
  };
}
