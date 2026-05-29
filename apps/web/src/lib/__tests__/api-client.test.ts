import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_GATE_EVENT, ApiTierError, apiFetch } from '@/lib/api-client';

// Lightweight `window` stand-in so apiFetch's dispatch works without
// pulling jsdom into a node-environment test. The contract we care
// about is: an event with the correct detail is dispatched whenever
// apiFetch sees a 402.
class FakeEventTarget {
  private readonly listeners = new Map<string, Array<(e: Event) => void>>();
  addEventListener(type: string, cb: (e: Event) => void) {
    const arr = this.listeners.get(type) ?? [];
    arr.push(cb);
    this.listeners.set(type, arr);
  }
  dispatchEvent(event: Event & { type: string }) {
    for (const cb of this.listeners.get(event.type) ?? []) cb(event);
    return true;
  }
  clear() {
    this.listeners.clear();
  }
}
const fakeWindow = new FakeEventTarget();
// CustomEvent isn't defined in Node either; vitest's `globalThis`
// allows polyfilling. Use a minimal shim that only carries `detail`.
class FakeCustomEvent<T> extends Event {
  detail: T;
  constructor(type: string, init: { detail: T }) {
    super(type);
    this.detail = init.detail;
  }
}
// @ts-expect-error -- assigning shims for the duration of the suite
globalThis.window = fakeWindow;
// @ts-expect-error -- shim
globalThis.CustomEvent = FakeCustomEvent;

/**
 * Locks the apiFetch 402 contract — the canonicalisation of server tier-
 * gate bodies into the typed FeatureGateName + tier the UpgradeModal
 * speaks. Both the server (lib/billing/tier.ts) and the modal depend on
 * this mapping; a drift here silently breaks the upgrade flow on prod
 * (the listener fires but the modal shows the wrong copy).
 */

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('apiFetch — 402 interception', () => {
  let dispatched: Array<{ feature: string; requiredTier: string }>;
  // Avoid threading vitest's strict MockInstance generic — we only need
  // mockResolvedValueOnce + restore, both of which the runtime exposes.
  let fetchSpy: { mockResolvedValueOnce: (r: Response) => unknown; mockRestore: () => void };

  beforeEach(() => {
    dispatched = [];
    fakeWindow.clear();
    fakeWindow.addEventListener(API_GATE_EVENT, (e) => {
      const d = (e as Event & { detail: { feature: string; requiredTier: string } }).detail;
      dispatched.push(d);
    });
    fetchSpy = vi.spyOn(globalThis, 'fetch') as unknown as typeof fetchSpy;
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('passes 2xx responses through unchanged (no event, no throw)', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, { ok: true }));
    const res = await apiFetch('/api/anything');
    expect(res.status).toBe(200);
    expect(dispatched).toHaveLength(0);
  });

  it.each([
    {
      label: 'resume limit TIER_LIMIT',
      body: {
        code: 'TIER_LIMIT',
        reasonKey: 'billing.gate.resume_limit',
        requiredTier: 'plus',
      },
      feature: 'resume_limit',
      tier: 'plus',
    },
    {
      label: 'generation limit',
      body: {
        code: 'TIER_LIMIT',
        reasonKey: 'billing.gate.generation_limit',
        requiredTier: 'plus',
      },
      feature: 'generation_limit',
      tier: 'plus',
    },
    {
      label: 'cover-letter limit',
      body: {
        code: 'TIER_LIMIT',
        reasonKey: 'billing.gate.cover_letter_limit',
        requiredTier: 'plus',
      },
      feature: 'cover_letter',
      tier: 'plus',
    },
    {
      label: 'cover-letter disabled',
      body: {
        code: 'TIER_LIMIT',
        reasonKey: 'billing.gate.cover_letter_disabled',
        requiredTier: 'plus',
      },
      feature: 'cover_letter',
      tier: 'plus',
    },
    {
      label: 'template locked',
      body: {
        code: 'TIER_LIMIT',
        reasonKey: 'billing.gate.template_locked',
        requiredTier: 'plus',
      },
      feature: 'template_locked',
      tier: 'plus',
    },
    {
      label: 'llm-model tier_gate (uses `feature` field directly)',
      body: { error: 'tier_gate', feature: 'model_choice', requiredTier: 'pro' },
      feature: 'model_choice',
      tier: 'pro',
    },
  ])('maps $label → ($feature, $tier)', async ({ body, feature, tier }) => {
    fetchSpy.mockResolvedValueOnce(mockResponse(402, body));
    await expect(apiFetch('/api/whatever')).rejects.toBeInstanceOf(ApiTierError);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({ feature, requiredTier: tier });
  });

  it('falls back to (resume_limit, plus) for an unknown reasonKey', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(402, { code: 'TIER_LIMIT', reasonKey: 'billing.gate.something_new' }),
    );
    await expect(apiFetch('/api/whatever')).rejects.toBeInstanceOf(ApiTierError);
    expect(dispatched[0]).toEqual({ feature: 'resume_limit', requiredTier: 'plus' });
  });

  it('falls back gracefully on a malformed 402 body', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('not-json', { status: 402, headers: { 'content-type': 'text/plain' } }),
    );
    await expect(apiFetch('/api/whatever')).rejects.toBeInstanceOf(ApiTierError);
    expect(dispatched[0]).toEqual({ feature: 'resume_limit', requiredTier: 'plus' });
  });

  it('does NOT promote requiredTier to pro unless the server explicitly says so', async () => {
    // Defensive: the modal copy escalates for `pro`; we must not over-prompt.
    fetchSpy.mockResolvedValueOnce(mockResponse(402, { code: 'TIER_LIMIT' }));
    await expect(apiFetch('/api/whatever')).rejects.toBeInstanceOf(ApiTierError);
    expect(dispatched[0]?.requiredTier).toBe('plus');
  });
});
