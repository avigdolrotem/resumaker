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
          // Fire welcome email + audit. Don't block sign-up on these.
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
