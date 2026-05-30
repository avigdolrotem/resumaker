# Key Rotation Runbook — 2026-05-28

Status of the secret-rotation pass before session handoff.

## Already rotated this session (live + verified)

| Secret                       | How                                                                      | Verified                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `BETTER_AUTH_SECRET`         | `openssl rand -base64 48` → Secret Manager v2 + live k8s Secret → rolled | All sessions invalidated (intended). Sign-in re-issues fresh sessions.                           |
| `CRON_SECRET`                | `openssl rand -base64 32` → SM v2 + k8s → rolled                         | App + 3 CronJobs read the same key; consistent post-roll                                         |
| `IP_HASH_SALT`               | `openssl rand -base64 48` → SM v2 + k8s → rolled                         | Audit-log IP hashes re-keyed (old hashes no longer correlate — by design)                        |
| `DATABASE_URL` (postgres pw) | `gcloud sql users set-password postgres` + rebuilt URL → k8s → rolled    | `/api/health/ready` → `database: ok, latencyMs: 1` ✅                                            |
| `ANTHROPIC_API_KEY`          | **destroyed** (version 1)                                                | App uses Vertex AI ADC; not referenced by the deployment. Removed historical-exposure liability. |

The previously-leaked break-glass postgres password is now invalid (rotated).

## Third-party keys — operator to rotate (keys never transit chat)

For each: regenerate in the provider dashboard, then push the new value via stdin so it never appears in shell history, then roll.

### Sentry DSN (highest priority — leaked in git history `adbba50`)

```bash
# 1. sentry.io → Settings → Projects → resumaker → Client Keys (DSN) → "Generate New Key", revoke old
# 2. push (paste value at the prompt; --data-file=- reads stdin, nothing in argv/history):
gcloud secrets versions add sentry-dsn --data-file=- --project=resumaker-497309
# 3. patch live k8s secret + roll:
NEW=$(gcloud secrets versions access latest --secret=sentry-dsn --project=resumaker-497309)
kubectl -n resumaker patch secret resumaker-app --type=json \
  -p="[{\"op\":\"replace\",\"path\":\"/data/SENTRY_DSN\",\"value\":\"$(printf '%s' "$NEW" | base64 | tr -d '\n')\"}]"
kubectl -n resumaker rollout restart deploy/resumaker
```

### Resend API key

```bash
# 1. resend.com → API Keys → create new (full access), delete old AFTER step 3 succeeds
# 2. gcloud secrets versions add resend-api-key --data-file=- --project=resumaker-497309
# 3. NEW=$(gcloud secrets versions access latest --secret=resend-api-key --project=resumaker-497309)
#    kubectl -n resumaker patch secret resumaker-app --type=json \
#      -p="[{\"op\":\"replace\",\"path\":\"/data/RESEND_API_KEY\",\"value\":\"$(printf '%s' "$NEW" | base64 | tr -d '\n')\"}]"
#    kubectl -n resumaker rollout restart deploy/resumaker
# 4. Send a test verification email to confirm before deleting the old key.
```

### Google OAuth client secret (NOT the client ID — that's not secret)

```bash
# 1. console.cloud.google.com → APIs & Services → Credentials → the OAuth 2.0 Client
#    → "Add secret" (rotation grace), or "Reset secret"
# 2. gcloud secrets versions add google-client-secret --data-file=- --project=resumaker-497309
# 3. NEW=$(gcloud secrets versions access latest --secret=google-client-secret --project=resumaker-497309)
#    kubectl -n resumaker patch secret resumaker-app --type=json \
#      -p="[{\"op\":\"replace\",\"path\":\"/data/GOOGLE_CLIENT_SECRET\",\"value\":\"$(printf '%s' "$NEW" | base64 | tr -d '\n')\"}]"
#    kubectl -n resumaker rollout restart deploy/resumaker
# 4. Test Google sign-in BEFORE deleting the old secret in Console (grace-period overlap avoids downtime).
```

## Empty secrets — nothing to rotate

`firecrawl-api-key`, `github-client-id/secret`, `lemonsqueezy-*`, `stripe-*`, `vapid-private-key` — all empty (features not enabled). Populate when those features go live.

## kubectl context reminder

```bash
export PATH="/opt/homebrew/Caskroom/gcloud-cli/<ver>/google-cloud-sdk/bin:$PATH"  # for gke-gcloud-auth-plugin
# GKE master is IP-allowlisted to the operator's home IP. From another network:
#   gcloud container clusters update resumaker-prod --region=europe-west1 \
#     --enable-master-authorized-networks --master-authorized-networks=<your-ip>/32
```
