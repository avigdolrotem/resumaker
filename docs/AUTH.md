# Authentication & Authorization

## Stack

- **Library**: [Better Auth](https://better-auth.com) v1.x
- **Database**: Postgres (sessions, accounts, users tables)
- **OAuth providers**: Google, GitHub
- **Optional methods**: Magic link, TOTP 2FA, Passkey (WebAuthn)

## Why Better Auth

1. **TypeScript-first** — full type safety on session/user objects
2. **Lives in our codebase** — looks self-built (portfolio narrative)
3. **Database-agnostic** — works with Drizzle ORM + Postgres
4. **Modern features** — passkeys, multi-factor, organizations
5. **Open source** — no vendor lock-in, no SaaS cost
6. **Active development** — community traction in 2026

## User Flows

### Sign Up

```
1. User clicks "הרשמה" (Sign up) or chooses OAuth provider
2. Email path:
   - User enters email + password
   - Password validated (min 12 chars, breached-password check via HIBP API)
   - Account created (status: pending_verification)
   - Verification email sent (Resend or SES)
   - User clicks link → account activated
3. OAuth path:
   - Redirect to Google/GitHub
   - Callback → upsert user → session created
4. Welcome email sent
5. Redirect to onboarding (profile setup)
```

### Sign In

```
1. User enters email + password
2. Password verified (Argon2id)
3. If 2FA enabled → prompt for TOTP code
4. Session created (rotating refresh token)
5. Cookie set (httpOnly, secure, SameSite=Lax)
6. Redirect to dashboard
```

### Magic Link

```
1. User enters email only
2. Single-use token (10 min expiry) emailed
3. Click → session created
4. Token consumed (one-time use)
```

### Passkey (WebAuthn)

```
1. User registers passkey (once, per-device)
2. On login: browser prompts FaceID/TouchID/Windows Hello
3. Cryptographic challenge/response
4. Session created
```

### Forgot Password

```
1. User enters email
2. (Same response regardless of email existing → no enumeration)
3. If exists: reset token (1 hour expiry) emailed
4. Click → new password form → password updated
5. ALL existing sessions for that user invalidated
6. Notification email sent ("password was reset")
```

## Session Management

| Aspect     | Detail                                    |
| ---------- | ----------------------------------------- |
| Storage    | Postgres `sessions` table                 |
| Token      | Random 32-byte ID in httpOnly cookie      |
| Rotation   | New token on every elevated action        |
| Expiry     | 30 days idle, 90 days absolute            |
| Bind to    | IP (loose match) + User-Agent fingerprint |
| Logout     | Revoke single session OR all sessions     |
| Concurrent | Multiple devices allowed                  |

## Account Structure

### Schema (Postgres)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) UNIQUE NOT NULL,
  email_verified TIMESTAMPTZ,
  name VARCHAR(255),
  image_url TEXT,
  locale VARCHAR(8) DEFAULT 'he',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  role VARCHAR(32) NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','support'))
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  password_hash TEXT,
  refresh_token TEXT,
  access_token TEXT,
  expires_at TIMESTAMPTZ,
  UNIQUE (provider, provider_account_id)
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_addr INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

CREATE TABLE verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  purpose VARCHAR(32) NOT NULL CHECK (purpose IN ('email_verify','password_reset','magic_link','email_change')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE two_factor (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_encrypted TEXT NOT NULL,
  backup_codes JSONB NOT NULL,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key BYTEA NOT NULL,
  counter BIGINT NOT NULL,
  device_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
```

## Authorization Model

### Roles

- `user` — default, can manage own resumes and account
- `admin` — internal use, full access
- `support` — read-only access to user accounts (for help requests)

### Resource Ownership

Every resource (resume, generation, subscription) has `user_id`. Backend enforces:

```typescript
// Middleware
async function requireOwnership(resourceId: string, userId: string) {
  const owner = await db.query.resumes.findFirst({
    where: eq(resumes.id, resourceId),
    columns: { user_id: true },
  });
  if (owner?.user_id !== userId) throw new ForbiddenError();
}
```

### Postgres Row Level Security (Defense in Depth)

```sql
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_own_resumes ON resumes
  USING (user_id = current_setting('app.user_id')::uuid);
```

Backend sets `app.user_id` per transaction. Even if app code is buggy, DB refuses to leak.

## Multi-Factor Authentication

### Enrollment

```
1. User in settings clicks "Enable 2FA"
2. Backend generates TOTP secret + QR code
3. User scans with Google Authenticator / 1Password / Authy
4. User enters current code to confirm
5. Backend issues 10 single-use backup codes
6. User MUST save backup codes (shown once, downloadable as TXT)
7. 2FA enabled flag set
```

### Login Flow With 2FA

```
1. Password verified
2. Backend issues short-lived (5 min) "pending_mfa" token
3. Frontend prompts for TOTP
4. User submits code
5. Backend validates TOTP (allow ±1 step for clock skew)
6. Issue full session
```

### Recovery

If user lost 2FA device:

1. Backup codes (one-time use, must regenerate after exhaustion)
2. Identity verification via email + waiting period (24h)
3. Last resort: support ticket with ID verification

## OAuth Configuration

### Google

- Authorized redirect URI:
  - `https://resumaker.co.il/api/auth/callback/google`
- Scopes: `openid email profile`

### GitHub

- Same redirect pattern
- Scopes: `read:user user:email`

## Security Controls

| Control                        | Implementation                                                       |
| ------------------------------ | -------------------------------------------------------------------- |
| Password hashing               | Argon2id (memory: 64MB, iterations: 3, parallelism: 4)               |
| Breached password check        | HIBP API (k-anonymity) on registration + password change             |
| Rate limiting (login)          | 5 attempts per 15 min per IP, progressive backoff                    |
| Account enumeration prevention | Same response for "user not found" and "wrong password"              |
| Session fixation               | New session ID on every privilege escalation                         |
| CSRF                           | SameSite=Lax cookies + per-form tokens for state changes             |
| XSS                            | Strict CSP, no inline scripts/styles, React auto-escaping            |
| Clickjacking                   | `X-Frame-Options: DENY`                                              |
| Audit logging                  | Every auth event logged (login, logout, password change, 2FA toggle) |

## Endpoints

| Method | Path                             | Purpose                     |
| ------ | -------------------------------- | --------------------------- |
| POST   | `/api/auth/sign-up`              | Create account              |
| POST   | `/api/auth/sign-in`              | Email + password            |
| POST   | `/api/auth/sign-out`             | End session                 |
| GET    | `/api/auth/session`              | Get current session         |
| POST   | `/api/auth/forgot-password`      | Initiate reset              |
| POST   | `/api/auth/reset-password`       | Complete reset              |
| GET    | `/api/auth/sign-in/google`       | OAuth redirect              |
| GET    | `/api/auth/callback/google`      | OAuth callback              |
| POST   | `/api/auth/2fa/enable`           | Begin 2FA enrollment        |
| POST   | `/api/auth/2fa/verify`           | Confirm 2FA setup           |
| POST   | `/api/auth/2fa/disable`          | Remove 2FA                  |
| POST   | `/api/auth/passkey/register`     | Add passkey                 |
| POST   | `/api/auth/passkey/authenticate` | Login via passkey           |
| GET    | `/api/auth/sessions`             | List user's active sessions |
| DELETE | `/api/auth/sessions/:id`         | Revoke specific session     |
| DELETE | `/api/auth/sessions/all`         | Revoke all sessions         |

## Related

- [SECURITY.md](SECURITY.md) — Threat model
- [ARCHITECTURE.md](ARCHITECTURE.md) — Overall design
