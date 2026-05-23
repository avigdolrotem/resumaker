# Runbook: Secret Rotation

> Quarterly cadence + emergency rotation on suspicion of exposure.

## Inventory

| Secret                     | Storage               | Rotation cadence        | Impact of rotation               |
| -------------------------- | --------------------- | ----------------------- | -------------------------------- |
| `AWS_ACCESS_KEY_ID/SECRET` | IAM                   | 90 days                 | None (zero-downtime)             |
| `ANTHROPIC_API_KEY`        | console.anthropic.com | 180 days                | None                             |
| `BETTER_AUTH_SECRET`       | env                   | 365 days                | **Invalidates all sessions**     |
| `RESEND_API_KEY`           | resend.com            | 180 days                | None (queue retries)             |
| `SENTRY_DSN`               | sentry.io             | Never (it's public-ish) | n/a                              |
| `STRIPE_SECRET_KEY`        | dashboard.stripe.com  | 180 days                | None (use rolling)               |
| `STRIPE_WEBHOOK_SECRET`    | dashboard.stripe.com  | On compromise           | Webhooks fail briefly            |
| `CRON_SECRET`              | env (CI + Vercel)     | 365 days                | Cron skips one run if mismatched |
| Postgres password          | RDS                   | 90 days                 | Brief restart needed             |

## Standard rotation procedure

For zero-downtime rotation (most secrets):

```bash
# 1. Generate or obtain new secret
NEW_KEY=$(openssl rand -base64 32)  # for BETTER_AUTH_SECRET, CRON_SECRET
# Or copy from provider dashboard

# 2. Update in secret store (AWS Secrets Manager or GitHub Actions)
aws secretsmanager update-secret \
  --secret-id resumaker/prod/anthropic \
  --secret-string "$NEW_KEY"

# 3. Trigger redeploy
gh workflow run deploy-prod.yml

# 4. Wait for rollout to complete
kubectl rollout status deployment/web -n resumaker

# 5. Verify
kubectl exec -n resumaker deploy/web -- env | grep ANTHROPIC

# 6. Revoke old key in provider (24h grace for in-flight requests)
```

## Emergency rotation (key leaked)

When a key was committed to git, posted publicly, or stolen:

```bash
# 1. IMMEDIATELY revoke the old key at the provider
# Anthropic: console.anthropic.com → API Keys → Delete
# AWS: IAM → Users → user → Security credentials → Delete

# 2. Rotate (steps above)

# 3. Audit recent usage to estimate damage
# Anthropic: check usage dashboard for anomalies
# AWS: aws cloudtrail lookup-events --lookup-attributes AttributeKey=Username,AttributeValue=claude-code-resumaker

# 4. If signs of misuse → file incident report
```

## BETTER_AUTH_SECRET rotation (special case)

This invalidates every active session. Schedule maintenance window:

```bash
# 1. Generate new secret
NEW=$(openssl rand -base64 32)

# 2. Communicate: "Brief sign-out everywhere at HH:MM"

# 3. Update + deploy
# (steps above)

# 4. All users get redirected to /sign-in next request
# Their sessions are invalid; new sessions sign new tokens

# 5. No cleanup needed — old tokens just fail validation
```

## Postgres password rotation

```bash
# 1. Modify in RDS console (Modify → Manage master credentials → Rotate)
# AWS Secrets Manager handles the rotation; app uses Secrets Manager reference

# 2. App restart is automatic if using Secrets Manager auto-rotation Lambda

# 3. Verify
kubectl exec -n resumaker deploy/web -- env | grep DATABASE_URL  # should show updated reference
```

## Stripe webhook rotation

When `STRIPE_WEBHOOK_SECRET` rotates, in-flight webhooks fail signature verification. Mitigation:

1. Generate new endpoint in Stripe dashboard (don't delete old yet)
2. Configure new endpoint with new secret in our env
3. Deploy with new secret
4. Wait 24h for in-flight retries to clear
5. Delete old endpoint in Stripe dashboard

## What NOT to rotate

- TLS cert: handled by Cloudflare (Let's Encrypt or Universal)
- `SENTRY_DSN`: this is meant to be in client bundles, not really secret
- `NEXT_PUBLIC_*`: same, by definition public

## Audit trail

Every rotation should produce:

- Git commit (only the change to secret reference, not the value)
- Entry in `docs/audits/key-rotations.md` (date, what, by whom, reason)
- Slack notification to #ops

---

**Author**: Rotem · **Last updated**: 2026-05-23
