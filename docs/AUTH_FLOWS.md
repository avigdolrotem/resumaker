# Auth Flows — Resumaker

How sign-up, sign-in, email verification, and account linking work in production. Source of truth: [`apps/web/src/lib/auth.ts`](../apps/web/src/lib/auth.ts), Better Auth 1.6.11, GCP Cloud SQL.

---

## TL;DR

| Signup method                  | Email verified at creation?                                                    | Verification email sent?                 | Can sign in immediately?                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Email + password               | **No**                                                                         | **Yes** (Resend in prod, console in dev) | **No** — `requireEmailVerification: true` blocks the sign-in flow until the user clicks the verification link |
| Google OAuth                   | **Yes** (Google asserts `email_verified=true`)                                 | No                                       | Yes                                                                                                           |
| GitHub OAuth                   | **Maybe** (GitHub only asserts verified for the user's primary verified email) | Only if `email_verified=false`           | Only if email is verified                                                                                     |
| Email change                   | New email starts unverified                                                    | Yes (to new address)                     | Old email continues to work until new is verified, then swap                                                  |
| Adding a linked OAuth provider | Inherits from new provider's assertion                                         | Only if not verified                     | Yes — account is already authed                                                                               |

`requireEmailVerification: true` is set unconditionally per operator requirement: identity must be confirmed before account activation. See [`apps/web/src/lib/auth.ts:86-95`](../apps/web/src/lib/auth.ts).

---

## Signup paths in detail

### A. Email + password

1. User visits `/sign-up`, enters email + password (min 12 chars), submits to `POST /api/auth/sign-up/email`.
2. Better Auth creates the user row (`users.email_verified = false`) and a verification token row.
3. `sendVerificationEmail` callback fires:
   - In prod (`RESEND_API_KEY` set): Resend sends the email with a 24-hour-expiring link to `/api/auth/verify-email?token=...`.
   - In dev (`RESEND_API_KEY` empty): the email body is logged to console for the developer to copy out.
4. The user's session is **not yet usable for protected routes** — every `requireActiveUser` / `requireFreshSession` check rejects until `users.email_verified = true`.
5. User clicks the link → `verify-email` route flips `email_verified = true` and redirects to `/onboarding`.

**Failure mode**: if Resend is unhealthy when a credential signup happens, the user gets a generic "something went wrong" page and the verification email never arrives. Workaround: they can re-trigger via the "resend verification" link on the sign-in page, which calls `sendVerificationEmail` again. **Open work item**: capture Resend failures in Sentry separately so we can alert before users complain (currently bundled with generic 500s).

### B. Google OAuth

1. User clicks "Continue with Google" on `/sign-in` or `/sign-up`.
2. Better Auth redirects to Google with the OAuth client ID from `GOOGLE_CLIENT_ID`.
3. Google's consent screen → user approves → callback to `https://resumaker.co.il/api/auth/callback/google?code=...&state=...`.
4. Better Auth exchanges the code for a token, fetches `userinfo`, and sees `email_verified: true` (Google guarantees this for `gmail.com` and verified G-Suite domains).
5. Better Auth creates `users` + `accounts` rows; sets `email_verified = true` immediately.
6. User is signed in and redirected to `/onboarding` (first time) or `/dashboard` (returning).

**Operator action required**: the redirect URI `https://resumaker.co.il/api/auth/callback/google` must be added to the OAuth 2.0 client in [console.cloud.google.com → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials). Until added, the callback returns `?error=redirect_uri_mismatch` and signup silently fails (this is the operator-reported issue from 2026-05-27).

### C. GitHub OAuth (currently OFF in prod)

`GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are empty in Secret Manager — the "Continue with GitHub" button is hidden by the sign-in page. When enabled:

- GitHub returns the user's primary email + a `verified` flag. If `verified: false`, our `sendVerificationEmail` fires immediately so the email-verified gate still applies.
- GitHub does NOT verify org-SSO secondary emails, so a user whose GitHub account uses an unverified address gets a credential-flow-style email verification step on top of the OAuth.

### D. Email change

1. Authed user POSTs `{ newEmail }` to `/api/account/email-change/request`.
2. Server returns a **neutral** response (`"If that address isn't already on file, you'll get a verification mail"`) regardless of whether `newEmail` is taken — closes the email-enumeration channel.
3. Verification email goes to the **new** address with a token.
4. User clicks → `/api/account/email-change/confirm?token=...` swaps `users.email` and sets `email_verified = true`.

**Known gap**: the old email does NOT receive a notification. Industry standard (Google, GitHub, Stripe) sends a "your email was changed — wasn't you?" to the old address. Tracked as Phase 1 finding G.16; medium severity; deferred.

**Known gap**: this flow uses `requireActiveUser` instead of `requireFreshSession`. A stolen 13-day session cookie + the user's current password (which the route re-verifies) can quietly pivot ownership. Tracked, deferred.

### E. Adding a linked OAuth provider

1. Signed-in user goes to `/settings → Linked Accounts → Connect Google/GitHub`.
2. Better Auth runs the OAuth dance, gets back a new `accounts` row keyed by `(provider, providerAccountId)`.
3. **Linking config** (`apps/web/src/lib/auth.ts:163-169`):
   - `accountLinking.enabled: true`
   - `accountLinking.allowDifferentEmails: false` — the OAuth provider's email **must match** the existing user's primary email. Closes the "attacker creates a GitHub account that asserts the victim's email, then links it to take over the victim's account" vector.

**Limitation**: a user with `avigdolrotem@gmail.com` as their primary cannot link a Google account that returns `rotem@avigdol.com`. This is the operator-reported question from 2026-05-27 about adding a second identity to the same account — see "Multi-email" below.

---

## Sign-in paths

### Email + password

`POST /api/auth/sign-in/email` with `{email, password}`. Better Auth verifies via bcrypt against `accounts.password`. If `requireEmailVerification: true` and `users.email_verified = false`, the response is `401 EMAIL_NOT_VERIFIED` and a re-verification email is sent automatically (rate-limited at 3/hour/IP via `/forget-password` bucket).

### OAuth

Same providers as signup. Better Auth matches on `(provider, providerAccountId)`. New device → new session row with `ip_hashed` (HMAC-SHA-256 of the source IP, see `apps/web/src/lib/audit.ts:hashIp`).

### Session lifecycle

- Cookie: `better-auth.session_token`, `HttpOnly`, `Secure` (when `BETTER_AUTH_URL` is `https://`), `SameSite=Lax`, `Path=/`.
- Default lifetime: 14 days, refreshed on every request that lands in `auth.api.getSession`.
- Revoke: `/api/account/sessions/[id]` DELETE (own sessions only), or `/api/account/password` POST which sets `revokeOtherSessions: true` to kill all other sessions when the password changes.
- Suspend / soft-delete: handled by `requireActiveUser` — any request from a soft-deleted or suspended user gets a 403 even if the cookie is fresh.

---

## Verification-bypass surfaces (defense-in-depth audit)

1. `requireEmailVerification: true` is global and applies to **every email/password sign-in**, not just signup. ✅
2. Routes guarded by `requireActiveUser` re-check `users.email_verified` server-side — even a smuggled session for an unverified user gets blocked. ✅
3. Admin endpoints guarded by `requireAdmin` + (now) `requireFreshSession` — fresh-session window is 15 minutes. ✅
4. OAuth providers' `email_verified` assertion is trusted; if Google ever returns `email_verified: false` (G-Suite domain misconfig), we should fall back to the credential-flow verification email. **Today we accept Google's assertion at face value.** Low risk for `@gmail.com`; medium for custom-domain G-Suite. Tracked.
5. Account-linking `allowDifferentEmails: false` blocks the OAuth-takeover-via-asserted-email vector. ✅

---

## Multi-email / multi-identity question (operator)

The operator wants both `avigdolrotem@gmail.com` (currently the Google-OAuth-authed primary) AND `rotem@avigdol.com` to point at the same account.

Better Auth 1.6.11 supports **exactly one email per user** — `users.email` is `UNIQUE` and there is no `user_emails` table. Three paths:

### Option A — Change primary email _(recommended)_

1. Sign in as `avigdolrotem@gmail.com`.
2. Go to `/settings → Account → Change email → enter rotem@avigdol.com`.
3. Click the verification link in the email that arrives at `rotem@avigdol.com`.
4. From then on, `users.email = 'rotem@avigdol.com'`. Google OAuth keeps working because `accounts` rows are keyed by `(provider, providerAccountId)`, not email — Google's stable `sub` claim still ties back to the same user row.

Pros: zero schema change, zero new endpoints, ~1 minute of operator work.
Cons: the old address no longer receives any product email; if the operator wants both addresses to receive notifications, this doesn't deliver that.

**This is the right path for the immediate goal.** Fix the missing gaps first (G.16: notify old address, and G.17: require fresh session on email-change), then run the swap.

### Option B — Add a `user_emails` table

Schema:

```sql
CREATE TABLE user_emails (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email       text NOT NULL UNIQUE,
  verified_at timestamptz,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

Touch points:

- Migration to backfill from `users.email`
- `auth.ts`: extend Better Auth via a custom adapter hook to look up `user_emails` instead of `users.email` at sign-in
- New `/api/account/emails` POST/DELETE/PATCH (add / verify / set primary)
- Email-change UI extension
- Audit + GDPR export to include the table

Cost estimate: ~300-400 LOC, 1-2 days of work.

Recommended only if multi-email turns into a real product feature (e.g. "tell me about jobs at both addresses"). Not worth doing just to satisfy this one request.

### Option C — `allowDifferentEmails: true` _(do not do)_

Flips the linking config. Re-opens the GitHub-takeover vector. Out.

---

## Operator runbook

### Grant admin to a user (one-time, manual)

```bash
# Cloud SQL is private-only; this opens a temporary proxy tunnel.
# Requires: gcloud auth login + iam.serviceAccountTokenCreator on
# resumaker-app@resumaker-497309.iam.gserviceaccount.com.

./scripts/grant-admin.sh prod avigdolrotem@gmail.com
```

The script:

1. Looks up the Cloud SQL instance name in the right project (`resumaker-497309` for prod by default; override via `PROJECT_ID=...` env).
2. Starts `cloud-sql-proxy` on localhost:15432.
3. Connects as the IAM-authed `resumaker-app` SA.
4. Prints the user's current state (id, role, verified, deleted).
5. Asks for explicit confirmation.
6. `UPDATE users SET role = 'admin'` (idempotent if already admin).
7. Tears down the proxy.

Audit trail: the script logs the action via the normal `audit_log` table because the UPDATE is committed alongside a row in `audit_log` (handled by app middleware on next sign-in — admins should sign out + in to ensure the new role is reflected in their session cookie).

### Add Google OAuth redirect URI to prod

1. [console.cloud.google.com → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Open the OAuth 2.0 Client ID used for Resumaker.
3. Authorized redirect URIs → Add → `https://resumaker.co.il/api/auth/callback/google`
4. Save. Takes effect immediately.

Test: open `https://resumaker.co.il/he/sign-up` on a fresh browser, click "Continue with Google", complete the consent flow. Should land on `/onboarding`. If it returns to sign-up with `?error=...`, the redirect URI is wrong.

### Email-verification debugging

If a user reports "the verification email never arrived":

1. Check Resend dashboard → resumaker.co.il → Logs. Filter by recipient. If not found, the API call failed — check pod logs (`stackdriver`, filter `email/client.ts`).
2. If sent but not delivered: missing DMARC/SPF/DKIM records is the most common cause. Resend's dashboard shows "needs DNS" if so.
3. If delivered but the user can't find it: probably in spam — the absence of DMARC/SPF/DKIM doesn't just hurt deliverability, it actively flags us as suspicious to Gmail/Outlook spam filters.

The Cloudflare DNS records needed (one-time operator action):

- SPF: `TXT @ "v=spf1 include:_spf.resend.com -all"`
- DKIM: `TXT resend._domainkey "...key..."` (Resend provides the value)
- DMARC: `TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@resumaker.co.il"`

After these land, deliverability improves measurably within 24-48 h.
