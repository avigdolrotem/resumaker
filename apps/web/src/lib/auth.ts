/**
 * Better Auth configuration.
 *
 * Server-side singleton — initialized once and shared.
 * Email + password by default; Google/GitHub OAuth when env vars are set.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import { schema } from '@/db/schema';
import { sendEmail, emailConfig } from '@/lib/email/client';
import { emailVerification, passwordReset, welcome } from '@/lib/email/templates';
import { auditEvent } from '@/lib/audit';
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
    },
  }),

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

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
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
