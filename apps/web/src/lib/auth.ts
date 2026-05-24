/**
 * Better Auth configuration.
 *
 * Server-side singleton — initialized once and shared.
 * Email + password by default; Google/GitHub OAuth when env vars are set.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { schema } from '@/db/schema';
import { sendEmail, emailConfig } from '@/lib/email/client';
import { emailVerification, passwordReset, welcome } from '@/lib/email/templates';
import { auditEvent, hashIp } from '@/lib/audit';
import { env } from '@/lib/env';
import { ensureSubscription } from '@/lib/billing/tier';

const secret = env.BETTER_AUTH_SECRET;
const baseUrl = env.BETTER_AUTH_URL;

/**
 * Detect locale from BETTER_AUTH callback URL. Better Auth includes
 * the redirect URL in the request; we sniff /he/ vs /en/ to pick
 * email language. Falls back to default locale.
 */
function detectLocale(url: string | undefined): 'he' | 'en' {
  if (!url) return env.DEFAULT_LOCALE;
  if (url.includes('/he/') || url.includes('/he?')) return 'he';
  if (url.includes('/en/') || url.includes('/en?')) return 'en';
  return env.DEFAULT_LOCALE;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      account: schema.accounts,
      session: schema.sessions,
      verification: schema.verifications,
      twoFactor: schema.twoFactors,
    },
  }),

  plugins: [
    twoFactor({
      issuer: 'Resumaker',
      totpOptions: { digits: 6, period: 30 },
      backupCodeOptions: { amount: 10, length: 10 },
    }),
  ],

  secret,
  baseURL: baseUrl,

  emailAndPassword: {
    enabled: true,
    // Verification required when email service is live. Dev mode logs
    // to console so flow can be tested without Resend.
    requireEmailVerification: emailConfig.isLive,
    minPasswordLength: 12,
    maxPasswordLength: 256,
    sendResetPassword: async ({ user, url }) => {
      const locale = detectLocale(url);
      const tmpl = passwordReset({ locale, resetUrl: url });
      const result = await sendEmail({ to: user.email, subject: tmpl.subject, html: tmpl.html });
      auditEvent({
        userId: user.id,
        event: 'password_reset_requested',
        metadata: { delivered: result.ok },
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const locale = detectLocale(url);
      const tmpl = emailVerification({ locale, verifyUrl: url });
      await sendEmail({ to: user.email, subject: tmpl.subject, html: tmpl.html });
    },
  },

  // Conditionally enable OAuth providers based on env. Better Auth's
  // socialProviders type expects the credentials object to be absent
  // (not undefined) when a provider is disabled, hence the spread guard.
  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
  },

  // Account-linking policy.
  //
  // Default Better Auth behavior: same-email accounts auto-link across
  // providers. That's the takeover vector — GitHub allows unverified
  // primary emails, so a malicious GitHub signup with victim@example.com
  // could attach to the victim's email/password account.
  //
  // We enable linking only for `google` (verified email is mandatory on
  // Google's side) and refuse cross-email linking entirely.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
      allowDifferentEmails: false,
    },
  },

  session: {
    // Down from 30d → 14d absolute. Stolen cookies are now bounded to
    // 14 days max regardless of activity. Combined with the freshness
    // gate (requireFreshSession in auth-guards.ts) used on destructive
    // routes, an attacker who steals a cookie cannot delete the account
    // or open the billing portal without re-authenticating.
    expiresIn: 60 * 60 * 24 * 14, // 14 days
    updateAge: 60 * 60 * 24, // refresh once per day
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  // Rate limiting on auth endpoints (signup, signin, password reset,
  // email verification resend). Better Auth applies these per-IP by
  // default; we set conservative limits to thwart credential stuffing
  // and email-bomb attacks.
  rateLimit: {
    enabled: true,
    window: 60, // seconds
    max: 10, // 10 attempts per IP per window across all auth routes
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60 * 60, max: 5 }, // 5 signups/hour/IP
      '/forget-password': { window: 60 * 60, max: 3 }, // 3/hour/IP
      '/send-verification-email': { window: 60 * 5, max: 3 },
    },
  },

  // Security defaults
  trustedOrigins: [baseUrl],
  advanced: {
    cookiePrefix: 'resumaker',
    useSecureCookies: env.NODE_ENV === 'production',
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Critical: await subscription row creation so the user's
          // first request can read their tier without racing. It's
          // idempotent (ON CONFLICT DO NOTHING) and fast.
          try {
            await ensureSubscription(user.id);
          } catch (err) {
            // Don't block sign-up — but surface via Sentry, not just console
            const { logger } = await import('@/lib/observability');
            logger.error(
              { err: (err as Error).message, userId: user.id },
              'auth.ensure_subscription_failed',
            );
          }

          // Welcome email is non-critical — fire and forget.
          void (async () => {
            const tmpl = welcome({ locale: env.DEFAULT_LOCALE, name: user.name ?? undefined });
            await sendEmail({ to: user.email, subject: tmpl.subject, html: tmpl.html });
          })();
          auditEvent({ userId: user.id, event: 'sign_up' });
        },
      },
    },
    session: {
      create: {
        // Runs before the row hits the DB. Two jobs:
        //   1. Block suspended / soft-deleted users from getting a fresh
        //      session even though Better Auth happily authenticated
        //      them. Throwing here aborts the sign-in flow.
        //   2. HMAC-hash the captured IP so plaintext IPs never land
        //      in the `sessions` table (parity with audit_log.ipHash).
        before: async (session) => {
          const user = await db.query.users.findFirst({
            where: eq(schema.users.id, session.userId),
            columns: { role: true, deletedAt: true },
          });
          if (user?.role === 'suspended' || user?.deletedAt) {
            // Audit the rejected sign-in attempt so support can see it.
            auditEvent({
              userId: session.userId,
              event: 'sign_in_failed',
              metadata: { reason: 'suspended_or_deleted' },
            });
            throw new Error('ACCOUNT_SUSPENDED');
          }
          // Replace raw IP with hash. `hashIp` returns null when there
          // is no secret configured; we'd rather store nothing than a
          // plain IP, so the null fallthrough is intentional.
          return {
            data: {
              ...session,
              ipAddress: hashIp(session.ipAddress) ?? null,
            },
          };
        },
        after: async (session) => {
          auditEvent({
            userId: session.userId,
            event: 'sign_in',
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
          });
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
