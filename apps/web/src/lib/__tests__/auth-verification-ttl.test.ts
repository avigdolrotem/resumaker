import { describe, it, expect } from 'vitest';

/**
 * Regression guard for the email-verification-link-fails-after-1-hour bug.
 *
 * Symptom (real user, 2026-05-27): friend signed up via email+password,
 * verification email landed in spam (no SPF/DKIM/DMARC yet), she dug it
 * out after 1+ hour, clicked the link → verification failed. She then
 * couldn't sign in because requireEmailVerification:true blocks
 * unverified accounts.
 *
 * Root cause: Better Auth's default emailVerification.expiresIn is 1
 * hour. We didn't override it, so spam-folder discovery + click cycle
 * blew past the window every time.
 *
 * Fix: emailVerification.expiresIn = 3 days. This test guards the
 * regression by reading the betterAuth() options object and asserting
 * the TTL is at least 24 hours.
 */
describe('email verification TTL', () => {
  it('expiresIn is at least 24 hours so spam-delayed clicks succeed', async () => {
    const { auth } = await import('@/lib/auth');
    type AuthWithOptions = {
      options: { emailVerification?: { expiresIn?: number } };
    };
    const options = (auth as unknown as AuthWithOptions).options;
    const ttl = options.emailVerification?.expiresIn ?? 60 * 60; // Better Auth default
    expect(
      ttl,
      'verification token TTL must be >= 86400 s (24 h) to survive spam-folder delays — see auth.ts emailVerification.expiresIn',
    ).toBeGreaterThanOrEqual(60 * 60 * 24);
  });
});
