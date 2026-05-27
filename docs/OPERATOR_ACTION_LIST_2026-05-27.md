# Operator Action List — 2026-05-27

Single-source-of-truth for the full-GCP launch.

---

## What's live

- **Project**: `resumaker-497309` (region `europe-west1`)
- **Cluster**: `resumaker-prod` (GKE Autopilot)
- **Image registry**: `europe-west1-docker.pkg.dev/resumaker-497309/resumaker`
- **State bucket**: `gs://resumaker-prod-tfstate`
- **Secrets**: `projects/resumaker-497309/secrets/*`
- **App URL**: `https://resumaker.co.il` (after DNS cutover)

Service accounts:

- App pods: `resumaker-app@resumaker-497309.iam.gserviceaccount.com`
- CI/CD: `resumaker-cicd@resumaker-497309.iam.gserviceaccount.com`

---

## What changed (summary)

| Phase         | What                                     | PR                                                     |
| ------------- | ---------------------------------------- | ------------------------------------------------------ |
| CI fix        | pnpm/action-setup version conflict       | [#2](https://github.com/avigdolrotem/resumaker/pull/2) |
| multi-ai-3a   | Vercel AI Gateway abstraction (Track 3A) | [#1](https://github.com/avigdolrotem/resumaker/pull/1) |
| gcp-migration | Full-GCP infra (Track 1)                 | [#3](https://github.com/avigdolrotem/resumaker/pull/3) |
| Phase A       | Vercel/Neon/AWS scrub                    | [#4](https://github.com/avigdolrotem/resumaker/pull/4) |
| Phase B       | Security + privacy + dep CVEs            | [#5](https://github.com/avigdolrotem/resumaker/pull/5) |
| Phase C       | Launch-blocking infra + cron timing-safe | [#6](https://github.com/avigdolrotem/resumaker/pull/6) |

---

## OPERATOR — DNS / accounts

### 1. Cloudflare DNS — cutover to GKE Ingress

- **Where**: Cloudflare dashboard → resumaker.co.il → DNS
- **What**:
  - **Delete** the old Vercel A/CNAME records for `@` and `www`
  - **Add** an A record: `@ → <GKE-INGRESS-IP>` (IP printed after `kubectl get ingress` post-deploy)
  - **Add** an A record: `www → <GKE-INGRESS-IP>` (same IP)
  - Cloudflare proxy: ☁️ enabled (orange cloud) — Cloudflare in front of GKE
  - **Delete** the two stale AWS ACM CNAMEs (`_xxx.resumaker.co.il`)
- **Why**: cuts traffic from Vercel to GKE; without this resumaker.co.il keeps resolving to Vercel
- **How to verify**: `dig resumaker.co.il +short` returns the GKE IP (or a Cloudflare IP, depending on proxy mode)

### 2. GitHub repo Settings → Environments

- **Where**: github.com/avigdolrotem/resumaker → Settings → Environments
- **What**: Create `production` environment, add required reviewer = yourself
- **Why**: gate deploys behind manual approval
- **How to verify**: trigger a manual deploy from `.github/workflows/deploy.yml`; should pause for review

### 3. Google OAuth consent screen → "In production"

- **Where**: console.cloud.google.com → APIs & Services → OAuth consent screen
- **What**: Move from "Testing" to "In production", verify domain ownership for resumaker.co.il
- **Why**: removes the 100-user testing cap; required for public OAuth
- **How to verify**: sign-in with a fresh Google account (not in test users)

### 4. LemonSqueezy live mode setup (post-approval)

- **Where**: app.lemonsqueezy.com → Store settings
- **What**:
  - Set up legal entity (your עוסק קטן when ready)
  - Create real products: Plus monthly/yearly/quarterly, Pro monthly/yearly/quarterly, Job Hunt Pack
  - Configure webhook → `https://resumaker.co.il/api/billing/webhook/lemonsqueezy`
  - Copy webhook signing secret + live API key + all 7 variant IDs
- **Why**: enables real payments — pricing page flips from waitlist to checkout buttons
- **How to verify**: pay with your own card on the live checkout, refund yourself

### 5. Sentry — rotate the leaked DSN

- **Where**: sentry.io → Settings → Client Keys (DSN)
- **What**: rotate the existing DSN (begins with `dd977...`) and create a new one
- **Why**: original was committed to git in commit `adbba50` (since scrubbed but historically exposed)
- **How to verify**: trigger a test error, confirm it shows up under the new DSN

### 6. Vercel + Neon teardown (after GKE smoke tests pass)

- **Where**: vercel.com + console.neon.tech
- **What**:
  - Verify `https://resumaker.co.il` is serving from GKE for 24h
  - Delete Vercel project
  - Pause/delete Neon project
  - Revoke Vercel API token (`vck_8aGD...`)
  - Revoke Neon connection string
- **Why**: closes the leaked-secrets loop; stops paying for unused services
- **How to verify**: try the revoked tokens — should 401

### 7. COMPANY_ADDRESS_HE/EN — real value

- **Where**: `apps/web/src/lib/constants/contact.ts:51-52`
- **What**: replace `'ישראל' / 'Israel'` placeholders with your real city or PO box
- **Why**: Israeli Consumer Protection law requires real business address on the invoice/receipt — LemonSqueezy live mode will reject orders without it
- **How to verify**: charge a test order, check the receipt PDF has the address

### 8. Optional: git-filter-repo to scrub history

- **What**: scrub the leaked Sentry DSN + personal email from git history
- **Why**: removes evidence even from old commits
- **How to verify**: `gitleaks detect --source . --no-banner` returns no findings
- **Note**: requires force-push + everyone re-clones — coordinate timing

---

## OPERATOR — Secrets in Secret Manager

After `tofu apply` finishes, each secret resource exists with NO value yet.
Populate them. Auto-generated ones can be generated by you or via the script.

| Secret name                                                 | What                      | Source                                           | How to set                                                                                                      |
| ----------------------------------------------------------- | ------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `better-auth-secret`                                        | Better Auth session HMAC  | **GENERATE**: `openssl rand -base64 48`          | `echo -n "<secret>" \| gcloud secrets versions add better-auth-secret --data-file=- --project=resumaker-497309` |
| `cron-secret`                                               | Cron route bearer token   | **GENERATE**: `openssl rand -base64 32`          | (same pattern)                                                                                                  |
| `ip-hash-salt`                                              | Audit log IP HMAC salt    | **GENERATE**: `openssl rand -base64 48`          | (same pattern)                                                                                                  |
| `ai-gateway-api-key`                                        | Vercel AI Gateway         | YOU (vercel.com → AI tab → key)                  | (same pattern)                                                                                                  |
| `anthropic-api-key`                                         | Direct Anthropic fallback | YOU (rotated — old key leaked)                   | (same pattern)                                                                                                  |
| `resend-api-key`                                            | Email sending             | YOU (resend.com → API Keys)                      | (same pattern)                                                                                                  |
| `google-client-id` + `google-client-secret`                 | OAuth                     | YOU (console.cloud.google.com → OAuth)           | (same pattern)                                                                                                  |
| `github-client-id` + `github-client-secret`                 | OAuth                     | YOU (github.com/settings/developers)             | (same pattern)                                                                                                  |
| `sentry-dsn`                                                | Rotated DSN               | YOU (sentry.io → Client Keys)                    | (same pattern)                                                                                                  |
| `lemonsqueezy-api-key` + `-webhook-secret` + 7× variant IDs | Billing                   | YOU (lemonsqueezy.com)                           | (same pattern)                                                                                                  |
| `firecrawl-api-key`                                         | JD URL fetcher (optional) | YOU (firecrawl.dev)                              | (same pattern)                                                                                                  |
| `vapid-public-key` + `vapid-private-key`                    | Web push                  | **GENERATE**: `npx web-push generate-vapid-keys` | (same pattern)                                                                                                  |

**BACKUP `better-auth-secret`** in your password manager — regenerating it invalidates every existing user session.

**Verification after populating**:

```
gcloud secrets list --project=resumaker-497309 --format="table(name)"
# Each secret should have at least one version:
gcloud secrets versions list better-auth-secret --project=resumaker-497309
```

---

## Open issues (DEFERRED from Phase B/C)

### High but not launch-blocking

- Cron CRON_SECRET timing-safe compare ✅ (done in Phase C)
- jobs/import + account/avatar + applications/[id]/{prep,follow-up} rate limits
- SSRF guard in packages/job-engine/src/importer.ts:fetchUrlText
- Memorystore `auth_enabled = true` (currently disabled)
- GKE master_authorized_networks (control plane currently public)
- Tofu admin SA narrowed from `roles/owner` to least-privilege

### Medium

- Cost trims: Cloud SQL prod tier db-custom-2-4096 → db-custom-1-3840 + ZONAL
- Memorystore prod BASIC vs STANDARD_HA (~$25 vs $50/mo)
- CSP nonce migration (drop `unsafe-inline`)
- ats-scanner + salary-estimator: generateText → generateObject
- bulk-import RFC-4180 CSV parser
- Cloud SQL Auth Proxy sidecar (use IAM auth not password)
- ManagedCertificate CRD initial DNS challenge — needs DNS pointing at LB _before_ cert provisions

### Low

- Duplicate stripHtml/escapeHtml consolidation
- Unused db-errors.ts exports
- CronJob securityContext / serviceAccountName
- packages/llm path consolidation (Task 3.6)

---

## Cost projection (after launch)

| Component                                               | Sized as                     | ~Monthly         |
| ------------------------------------------------------- | ---------------------------- | ---------------- |
| GKE Autopilot (1st cluster free management)             | min 1 pod web + 1 pod worker | $30-40           |
| Cloud SQL Postgres (current: REGIONAL db-custom-2-4096) | always on                    | $200-220         |
| Memorystore Redis (1GB STANDARD_HA)                     | always on                    | $50              |
| HTTPS LB + IP + egress                                  | always on                    | $25-30           |
| Artifact Registry + GCS + Cloud Logging                 | variable                     | $5-10            |
| **Total**                                               |                              | **~$310-350/mo** |

**Burn alert windows on $300 trial**:

- At $10/day → hit $50 alert in 5 days, $100 in 10 days, $300 in 30 days
- At $5/day → triple that

**Cost trim recommendations** (deferred items M1-M3):

- Cloud SQL → `db-custom-1-3840` ZONAL: -$120/mo
- Memorystore → BASIC: -$25/mo
- Total savings: ~$145/mo → realistic $165-200/mo

---

## How to roll back

If something goes wrong after deploy:

### Roll back Helm release (revert pod image, keep infra)

```
gcloud container clusters get-credentials resumaker-prod --region=europe-west1 --project=resumaker-497309
helm history resumaker -n resumaker
helm rollback resumaker <previous-revision> -n resumaker
```

### Tear down infra (LAST RESORT — destroys cluster + DB)

```
cd infra/tofu/environments/prod
tofu destroy -auto-approve   # ~10 min
# Then revert PR #3 to remove the code references
```

### Restore from Cloud SQL backup

```
gcloud sql backups list --instance=<INSTANCE> --project=resumaker-497309
gcloud sql backups restore <BACKUP_ID> --restore-instance=<INSTANCE> --project=resumaker-497309
```
