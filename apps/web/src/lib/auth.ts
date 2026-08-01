/**
 * Better Auth configuration.
 *
 * Server-side singleton — initialized once and shared.
 * Email + password by default; Google/GitHub OAuth when env vars are set.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { eq, sql } from 'drizzle-orm';
import { after } from 'next/server';
import { db } from '@/db';
import { schema } from '@/db/schema';
import { sendEmail } from '@/lib/email/client';
import { emailVerification, passwordReset, welcome } from '@/lib/email/templates';
import { auditEvent, hashIp } from '@/lib/audit';
import { env } from '@/lib/env';
import { ensureSubscription } from '@/lib/billing/tier';
import { isWithinRestoreWindow } from '@/lib/account-lifecycle';

const secret = env.BETTER_AUTH_SECRET;
const baseUrl = env.BETTER_AUTH_URL;

/**
 * Compute the full set of origins Better Auth will trust for cross-origin
 * requests. Defaults to both apex + www of `baseUrl` (auto-derived) plus
 * any explicit `BETTER_AUTH_URL_ALT`. Without this, a deploy that serves
 * traffic from both apex and www will silently reject auth from one of
 * them, breaking sign-in for half of users.
 */
function computeTrustedOrigins(): string[] {
  const origins = new Set<string>([baseUrl]);
  try {
    const u = new URL(baseUrl);
    if (u.hostname.startsWith('www.')) {
      const apex = `${u.protocol}//${u.hostname.slice(4)}${u.port ? `:${u.port}` : ''}`;
      origins.add(apex);
    } else if (!u.hostname.includes('localhost') && !u.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      const www = `${u.protocol}//www.${u.hostname}${u.port ? `:${u.port}` : ''}`;
      origins.add(www);
    }
  } catch {
    // BETTER_AUTH_URL was validated as URL at env parse time, so this
    // is unreachable. Keep the guard so a future env-shape change can't
    // crash auth bootstrap.
  }
  if (env.BETTER_AUTH_URL_ALT) origins.add(env.BETTER_AUTH_URL_ALT);

  return Array.from(origins);
}

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

/**
 * Send the welcome email. Called exactly once per account, at the moment the
 * email becomes verified — NOT at sign-up (which would arrive bundled with the
 * verification email). OAuth signups are created already-verified so they get
 * it from the user.create hook; email+password signups get it from
 * `afterEmailVerification` after they click the link.
 */
async function sendWelcomeEmail(user: { id: string; email: string; name?: string | null }) {
  const tmpl = welcome({ locale: env.DEFAULT_LOCALE, ...(user.name ? { name: user.name } : {}) });
  const result = await sendEmail({ to: user.email, subject: tmpl.subject, html: tmpl.html });
  if (!result.ok) {
    const { logger } = await import('@/lib/observability');
    logger.warn({ err: result.error, userId: user.id }, 'auth.welcome_email_send_failed');
  }
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
    // Always require verification — accounts can't sign in until the
    // user clicks the verification link in their email. In dev (no
    // RESEND_API_KEY) sendEmail() deliberately does NOT log the URL —
    // only a redacted "would have sent X to a***@b.com" line (see
    // lib/email/client.ts; verification/reset tokens in shell/log
    // history are a real exfil vector). There is currently no local
    // way to complete this flow through the UI alone — flip
    // `users.email_verified` to true directly in the DB for the
    // account under test instead.
    requireEmailVerification: true,
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
      // Throw on failure so Better Auth returns an error the client can
      // show, matching sendVerificationEmail below. Previously this
      // recorded `delivered: false` in the audit log and returned
      // normally, so the user was told to check their inbox for an
      // email that was never sent — and the only trace was a log line
      // nobody was watching.
      if (!result.ok) {
        throw new Error(`Failed to send password-reset email: ${result.error ?? 'unknown'}`);
      }
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    // Welcome email fires HERE — only once the user clicks the verification
    // link — so it never arrives bundled with the verification email itself.
    // (OAuth signups are created already-verified and get theirs from the
    // user.create hook instead, since they never hit this path.)
    afterEmailVerification: async (user) => {
      after(() => sendWelcomeEmail(user));
    },
    // 3 days. Better Auth defaults to 1 hour. Without SPF/DKIM/DMARC the
    // verification email lands in spam for many users; by the time they
    // dig it out and click, a 1-hour token has expired and they get
    // stuck — can't verify, can't sign in (requireEmailVerification:true
    // blocks unverified accounts). 3 days survives the spam-folder
    // discovery window. Once DNS is fixed we can bring this back down.
    expiresIn: 60 * 60 * 24 * 3,
    sendVerificationEmail: async ({ user, url }) => {
      const locale = detectLocale(url);
      const tmpl = emailVerification({ locale, verifyUrl: url });
      // Verification email failure is NOT silently OK: if the user never
      // receives it, they can't sign in (requireEmailVerification=true
      // when emailConfig.isLive). Throwing here makes Better Auth return
      // an error response so the client shows "couldn't send verification
      // email — please contact support" instead of a misleading
      // "check your inbox" message.
      const result = await sendEmail({ to: user.email, subject: tmpl.subject, html: tmpl.html });
      if (!result.ok) {
        auditEvent({
          userId: user.id,
          event: 'email_verification_send_failed',
          metadata: { error: result.error },
        });
        throw new Error(`Failed to send verification email: ${result.error ?? 'unknown'}`);
      }
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
  trustedOrigins: computeTrustedOrigins(),
  advanced: {
    cookiePrefix: 'resumaker',
    useSecureCookies: env.NODE_ENV === 'production',
  },

  // Request-lifecycle hooks (distinct from the databaseHooks below).
  hooks: {
    // Intercept sign-up for an email that belongs to a soft-deleted account
    // still inside its restore window. Without this, Better Auth rejects the
    // re-signup with a bare "user already exists" — baffling for someone who
    // deliberately deleted their account and now wants back in. We instead
    // return an actionable error (code ACCOUNT_PENDING_DELETION) that the
    // sign-up page renders as "sign in to restore your account" — and signing
    // in with the right password auto-restores it (see session.create.before).
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email') return;
      const body = ctx.body as { email?: unknown } | undefined;
      const email = typeof body?.email === 'string' ? body.email : '';
      if (!email) return;

      // Case-insensitive lookup: emails are compared case-insensitively
      // everywhere else (cf. the account-restore tooling), so a re-signup with
      // different casing must still match the pending-deletion row.
      const existing = await db.query.users.findFirst({
        where: sql`lower(${schema.users.email}) = lower(${email})`,
        columns: { id: true, deletedAt: true },
      });

      if (existing && isWithinRestoreWindow(existing.deletedAt)) {
        auditEvent({
          userId: existing.id,
          event: 'sign_in_failed',
          metadata: { reason: 'signup_on_pending_deletion' },
        });
        throw new APIError('UNPROCESSABLE_ENTITY', {
          message: 'This email has an account scheduled for deletion. Sign in to restore it.',
          code: 'ACCOUNT_PENDING_DELETION',
        });
      }
    }),
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

          // Welcome email: ONLY for already-verified signups (OAuth/social,
          // which skip the email-verification flow). Email+password signups
          // get the welcome from `afterEmailVerification` below — so the
          // welcome is NEVER sent alongside the verification email (the old
          // behavior fired both at sign-up, which read as a confusing
          // "double email"). Scheduled via Next's `after()` so it runs after
          // the response without blocking it.
          if (user.emailVerified) {
            after(() => sendWelcomeEmail(user));
          }
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

          // Suspended is an admin action — never self-restorable. Block with a
          // clean 403; throwing a bare Error here surfaces as an opaque 500.
          if (user?.role === 'suspended') {
            auditEvent({
              userId: session.userId,
              event: 'sign_in_failed',
              metadata: { reason: 'suspended' },
            });
            throw new APIError('FORBIDDEN', {
              message: 'This account has been suspended.',
              code: 'ACCOUNT_SUSPENDED',
            });
          }

          if (user?.deletedAt) {
            if (isWithinRestoreWindow(user.deletedAt)) {
              // Returning user with the correct credentials (Better Auth has
              // already verified the password / OAuth identity before this
              // hook). Honour the "I changed my mind" path: clear the
              // soft-delete and let them straight back in.
              await db
                .update(schema.users)
                .set({ deletedAt: null })
                .where(eq(schema.users.id, session.userId));
              auditEvent({
                userId: session.userId,
                event: 'account_restored',
                metadata: { via: 'sign_in' },
              });
            } else {
              // Past the grace window — the purge cron has (or imminently will
              // have) hard-deleted the data. Don't resurrect a tombstone.
              auditEvent({
                userId: session.userId,
                event: 'sign_in_failed',
                metadata: { reason: 'deleted_past_grace' },
              });
              throw new APIError('FORBIDDEN', {
                message: 'This account has been deleted.',
                code: 'ACCOUNT_DELETED',
              });
            }
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
          // IMPORTANT: `session.ipAddress` at this point is ALREADY HASHED
          // by the `before` hook above. Passing it to auditEvent would
          // hash it AGAIN (hashIp(hashIp(rawIp))) which yields a value
          // that doesn't correlate with anything in either table.
          //
          // Omit ipAddress here so audit_log.ipHash is null for sign_in
          // events. The raw-IP-derived hash is still in the sessions
          // table (set by the `before` hook). Cross-referencing for
          // abuse investigation is via userId + timestamp + sessions
          // join, which is what the admin tooling already does.
          auditEvent({
            userId: session.userId,
            event: 'sign_in',
            userAgent: session.userAgent,
          });
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
