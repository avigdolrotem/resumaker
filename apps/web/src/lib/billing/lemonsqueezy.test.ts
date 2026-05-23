/**
 * Tests for LemonSqueezy helpers that don't hit the network.
 * Webhook signature verification + variant-id round-tripping.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'crypto';

describe('verifyWebhookSignature', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 'test-secret-do-not-use-in-prod';
  });

  it('accepts a valid signature', async () => {
    const { verifyWebhookSignature } = await import('./lemonsqueezy');
    const body = '{"meta":{"event_name":"order_created"},"data":{}}';
    const sig = createHmac('sha256', 'test-secret-do-not-use-in-prod').update(body).digest('hex');
    expect(verifyWebhookSignature(body, sig)).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const { verifyWebhookSignature } = await import('./lemonsqueezy');
    const body = '{"meta":{"event_name":"order_created"},"data":{}}';
    const sig = createHmac('sha256', 'test-secret-do-not-use-in-prod').update(body).digest('hex');
    const tampered = body.replace('order_created', 'subscription_created');
    expect(verifyWebhookSignature(tampered, sig)).toBe(false);
  });

  it('rejects a wrong-length signature without throwing', async () => {
    const { verifyWebhookSignature } = await import('./lemonsqueezy');
    const body = '{"x":1}';
    expect(verifyWebhookSignature(body, 'aaa')).toBe(false);
  });

  it('throws when secret is unset', async () => {
    delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    const { verifyWebhookSignature } = await import('./lemonsqueezy');
    expect(() => verifyWebhookSignature('x', 'aa')).toThrow(/WEBHOOK_SECRET/);
  });
});

describe('resolveVariantId', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.LEMONSQUEEZY_VARIANT_PLUS_MONTHLY = '111';
    process.env.LEMONSQUEEZY_VARIANT_PLUS_YEARLY = '222';
    process.env.LEMONSQUEEZY_VARIANT_PLUS_QUARTERLY = '333';
    process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY = '444';
    process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY = '555';
    process.env.LEMONSQUEEZY_VARIANT_PRO_QUARTERLY = '666';
  });

  it('maps known variant ids to (tier, interval)', async () => {
    const { resolveVariantId } = await import('./lemonsqueezy');
    expect(resolveVariantId('111')).toEqual({ tier: 'plus', interval: 'monthly' });
    expect(resolveVariantId('222')).toEqual({ tier: 'plus', interval: 'yearly' });
    expect(resolveVariantId('333')).toEqual({ tier: 'plus', interval: 'quarterly' });
    expect(resolveVariantId('444')).toEqual({ tier: 'pro', interval: 'monthly' });
    expect(resolveVariantId('555')).toEqual({ tier: 'pro', interval: 'yearly' });
    expect(resolveVariantId('666')).toEqual({ tier: 'pro', interval: 'quarterly' });
  });

  it('returns null for unknown variant ids', async () => {
    const { resolveVariantId } = await import('./lemonsqueezy');
    expect(resolveVariantId('999')).toBeNull();
    expect(resolveVariantId('')).toBeNull();
  });
});

describe('mapLsStatus', () => {
  it('maps LS statuses to our internal enum', async () => {
    const { mapLsStatus } = await import('./lemonsqueezy');
    expect(mapLsStatus('active')).toBe('active');
    expect(mapLsStatus('on_trial')).toBe('trialing');
    expect(mapLsStatus('past_due')).toBe('past_due');
    expect(mapLsStatus('unpaid')).toBe('past_due');
    expect(mapLsStatus('paused')).toBe('past_due');
    expect(mapLsStatus('cancelled')).toBe('canceled');
    expect(mapLsStatus('expired')).toBe('canceled');
    expect(mapLsStatus('something-weird')).toBe('incomplete');
  });
});
