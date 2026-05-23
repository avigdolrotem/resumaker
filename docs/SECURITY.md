# Security

## Principles

1. **Defense in depth** — multiple layers, assume one will fail
2. **Least privilege** — every credential, role, IAM policy scoped tightly
3. **Zero trust** — verify every request, never trust internal networks blindly
4. **Encryption everywhere** — TLS in transit, AES at rest, no exceptions
5. **Visibility** — log everything sensitive, alert on anomalies
6. **Secure by default** — features ship locked down, opt-in to less restrictive

## Threat Model (STRIDE)

| Threat                     | Examples                     | Mitigation                                                    |
| -------------------------- | ---------------------------- | ------------------------------------------------------------- |
| **Spoofing**               | Fake user identity           | Better Auth + MFA + session binding                           |
| **Tampering**              | Modify resume in flight      | TLS, signed JWTs, DB constraints, idempotency                 |
| **Repudiation**            | "I didn't generate that"     | Audit log with signatures                                     |
| **Info disclosure**        | Leak user A's data to user B | Row-level checks, no shared cache by user, S3 per-user prefix |
| **Denial of service**      | Spam costly LLM calls        | Rate limits, Cloudflare WAF, circuit breakers                 |
| **Elevation of privilege** | Normal user gets admin       | RBAC tested in CI, no user-controlled role assignment         |

## OWASP Top 10 Coverage

| Risk                          | Implementation                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------ |
| A01 Broken Access Control     | Better Auth + RLS in Postgres + IAM policies                                   |
| A02 Cryptographic Failures    | TLS 1.3, AES-256, no MD5/SHA1, secret rotation                                 |
| A03 Injection                 | Drizzle parameterized queries, Zod validation, no string concat                |
| A04 Insecure Design           | This document + threat models per service                                      |
| A05 Security Misconfiguration | OpenTofu enforces config, no manual changes in prod                            |
| A06 Vulnerable Components     | Dependabot, `pnpm audit`, `trivy` in CI                                        |
| A07 Auth & Identity           | Better Auth (industry-tested), MFA, passkeys                                   |
| A08 Data Integrity            | Signed JWTs, package lockfiles committed, signed container images              |
| A09 Logging Failures          | Structured JSON logs, Loki, Sentry, audit trail                                |
| A10 SSRF                      | Strict allowlist for outbound HTTP, no user-controlled URLs without validation |

## OWASP LLM Top 10

See [AI_SAFETY.md](AI_SAFETY.md) for detailed treatment.

| Risk                            | Implementation                                                  |
| ------------------------------- | --------------------------------------------------------------- |
| LLM01 Prompt Injection          | Multi-layer input filter, structured prompts, output validation |
| LLM02 Insecure Output Handling  | Zod schema, never `eval()`, no LLM-controlled URLs              |
| LLM03 Training Data Poisoning   | We don't train; we consume Claude/etc                           |
| LLM04 Model DoS                 | Rate limits, input length caps, circuit breaker                 |
| LLM05 Supply Chain              | Pin LLM model versions, monitor provider                        |
| LLM06 Sensitive Info Disclosure | Strip PII from logs, no real names in error messages            |
| LLM07 Insecure Plugins          | No tool use exposed to LLM via user prompts                     |
| LLM08 Excessive Agency          | LLM does ONE thing: structured text generation                  |
| LLM09 Overreliance              | UI flags AI-generated content, user reviews before download     |
| LLM10 Model Theft               | Don't expose system prompts via output, rate limit extraction   |

## Authentication

See [AUTH.md](AUTH.md) for full detail. Highlights:

- **Better Auth** with email/password (Argon2id), OAuth (Google, GitHub), magic links, TOTP 2FA, passkeys
- **Session storage**: DB-backed sessions with rotation on privilege escalation
- **Password requirements**: NIST 800-63B compliant (min 12 chars, no composition rules, breached-password check)
- **Account lockout**: progressive delay after failed attempts (no hard lockout — DOS vector)
- **Session timeout**: 30 days inactive, 24h absolute for elevated operations

## Secrets Management

| Where                                   | What                                  | Access                   |
| --------------------------------------- | ------------------------------------- | ------------------------ |
| `/Volumes/Server_Data/secrets/` (local) | Dev keys, never committed             | Owner only (`chmod 600`) |
| AWS Secrets Manager (prod)              | All prod secrets                      | IAM role per service     |
| Cloudflare Secrets                      | Edge environment vars                 | Cloudflare dashboard     |
| GitHub Actions Secrets                  | CI secrets                            | Repo settings            |
| Vaultwarden (personal)                  | MFA recovery codes, account passwords | User only                |

### Rotation Policy

- Auto-rotation for AWS root keys: 90 days
- Manual rotation for LLM API keys: 180 days or on suspicion
- Immediate rotation if exposed (e.g., committed to git)

## Network Security

- **Cloudflare** as edge: WAF, DDoS protection, bot challenge
- **AWS VPC** with private subnets for backend
- **No public IPs** for backend services
- **Cloudflare Tunnel** for any backdoor access (zero open ports)
- **VPC peering** to dev/staging only via SSO-authenticated VPN
- **Egress allowlist** for backend (only Anthropic, Stripe, etc.)

## Data Security

### Encryption

- **In transit**: TLS 1.3, modern cipher suites only, HSTS
- **At rest**:
  - RDS: AWS-managed encryption (KMS)
  - S3: SSE-KMS with customer-managed key
  - Backups: encrypted with separate key

### Data Classification

| Class        | Examples                     | Storage                                          |
| ------------ | ---------------------------- | ------------------------------------------------ |
| Public       | Marketing site content       | Plain CDN                                        |
| Internal     | Anonymized metrics           | Loki/Prometheus                                  |
| Confidential | User resumes, profiles       | Encrypted RDS + S3, role-scoped access           |
| Restricted   | Auth tokens, payment methods | Stripe-only, never our DB; refresh tokens hashed |

### PII Handling

- User can delete account → cascading delete in 30 days (legal hold window)
- Export user data on request (GDPR/Israeli law)
- No PII in logs (mask name, email, phone, IP-hash)

## Compliance

### Israeli Privacy Law of 1981 (updated 2024)

- Registration with Privacy Protection Authority if >10K user records (not at launch)
- Hebrew privacy policy + ToS
- Right of access, correction, deletion
- Breach notification within 72h

### GDPR (for EU users, even though not primary market)

- Lawful basis: legitimate interest (free tier) + contract (paid)
- Data Processing Addendum with sub-processors (Anthropic, Stripe, etc.)
- Right to erasure honored

## CI/CD Security

| Stage       | Check                                                           |
| ----------- | --------------------------------------------------------------- |
| Pre-commit  | gitleaks (secrets), prettier (consistency)                      |
| PR opened   | gitleaks history, trivy (deps + IaC), tflint, eslint, typecheck |
| Pre-merge   | SAST (semgrep), DAST (zap baseline on preview deploy)           |
| Pre-deploy  | Image signing (cosign), SBOM generation, image scan             |
| Post-deploy | Smoke tests, Sentry release marker, Grafana annotation          |

## Incident Response

### Severity Levels

| Level | Definition                           | Response           |
| ----- | ------------------------------------ | ------------------ |
| SEV-0 | Data breach, mass account compromise | <30 min, all hands |
| SEV-1 | Auth bypass, LLM injection working   | <1 hour, on-call   |
| SEV-2 | DOS, partial outage                  | <4 hours           |
| SEV-3 | Bug, single user affected            | <24 hours          |

### Runbooks

Live in `docs/runbooks/`:

- `auth-compromise.md`
- `llm-injection-detected.md`
- `cost-spike.md`
- `database-restore.md`
- `key-rotation.md`

## Security Testing

### Automated (every PR)

- `pnpm security:secrets` — gitleaks
- `pnpm security:deps` — pnpm audit + trivy
- `pnpm security:iac` — trivy on OpenTofu
- `tests/security/*` — adversarial test suite

### Quarterly

- Manual security review against threat model
- Dependency major-version review
- IAM policy review (least privilege drift)

### Annually

- External penetration test (post-launch)
- Security audit of LLM safety layer

## Bug Bounty

Post-launch: HackerOne or Bugcrowd program. Scope:

- In: production app, auth flows, LLM endpoints
- Out: development environments, social engineering

## Related

- [AI_SAFETY.md](AI_SAFETY.md)
- [AUTH.md](AUTH.md)
- [INFRASTRUCTURE.md](INFRASTRUCTURE.md)
