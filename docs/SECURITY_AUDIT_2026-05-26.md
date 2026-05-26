# Security + QA Audit Findings — 2026-05-26

Aggregated from 8 specialist review agents run pre-launch on `feat/gcp-migration`. Each finding is tagged with status: **FIXED** (this commit set), **OPERATOR** (you need to do something), or **DEFERRED** (post-launch).

---

## Critical (would block production)

### A. Missing `ExternalSecret` Helm template — pods won't schedule

Status: FIXED (Helm template added).

`infra/helm/resumaker/templates/deployment.yaml` references `secretKeyRef` against three Kubernetes Secrets (`resumaker-app`, `resumaker-db`, `resumaker-redis`) but the chart had no `ExternalSecret` CRD template to populate them on GKE. `infra/gitops/secrets/` had AWS-targeted ones only. Result: pods would fail to schedule with `secret "resumaker-app" not found`.

Fix: added `infra/helm/resumaker/templates/externalsecret.yaml` gated on `externalSecrets.enabled` that emits ExternalSecret resources against the GCP Secret Manager store for the three required secrets.

### B. Heredoc indentation in `deploy-gcp.yml` produces unparseable YAML

Status: FIXED.

The `cat > values.<env>-gcp.image.yaml <<EOF` block inside a 10-space-indented `run:` block captured whitespace verbatim, producing YAML with `image:` indented at column 10. Helm would reject it; ArgoCD would silently not sync; pods would keep the previous image.

Fix: switched to `<<-EOF` with tabs OR a separate `printf` step that writes a clean file.

### C. `DATABASE_URL` unconditionally required — GKE app crashes at startup

Status: FIXED.

`apps/web/src/lib/env.ts:31` required `DATABASE_URL`. On GKE we use Cloud SQL Connector + IAM and never set `DATABASE_URL`. The Zod parse threw before the process could bind a port.

Fix: `DATABASE_URL` is now `.optional()`. GCP env vars (`GCP_CLOUD_SQL_INSTANCE`, `GCP_CLOUD_SQL_IAM_USER`) are now required.

### D. Sentry DSN with project key committed to git

Status: OPERATOR — must rotate.

`docs/runbooks/github-actions-oidc-setup.md` (commit `adbba50`) contains a real Sentry DSN ingest key (`dd977b…`). The DSN is in the public branch history. Sentry DSNs are nominally public-by-design but the ingest key controls error ingestion rate and can be used for data injection.

**You must:** rotate the DSN in the Sentry project (Settings → Client Keys → Rotate). The runbook has been sanitized to use `<your-sentry-dsn>` placeholder in this commit set, but the old DSN remains in git history.

### E. NODE_ENV: staging is invalid

Status: FIXED.

`values.staging-gcp.yaml` set `NODE_ENV: staging`. Next.js falls back to development mode for any non-`production`/`test` value, which enables stack-trace leaks in error responses.

Fix: `NODE_ENV: production` + new `APP_ENV: staging` flag for environment-specific behavior. Same fix applied to `values.dev-gcp.yaml`.

---

## Important (should fix before launch)

### F. Email enumeration on `/api/account/email-change/request`

Status: FIXED.

Returns HTTP 409 + `"That email is already registered"` when the target email is taken — lets an authenticated user enumerate registered emails.

Fix: returns HTTP 200 with a neutral message identical to the success case ("If that address isn't already on file, you'll get a verification mail"). Logs the conflict server-side for ops visibility.

### G. Raw IPs in structured logs (GDPR violation)

Status: FIXED.

`/api/tools/ats-scanner` and `/api/tools/salary-estimator` logged the raw client IP via `logger.error({ ip }, ...)`. The Sentry path was scrubbed; the GCP Cloud Logging path was not. IPs are personal data under Israeli Privacy Protection Law + GDPR.

Fix: replaced with `hashIp(ip)` at both call sites.

### H. TOCTOU on resume PATCH/DELETE

Status: FIXED.

`apps/web/src/app/api/resumes/[id]/route.ts:102` and `:128` confirmed ownership via `getOwnedResume()` but the final UPDATE/DELETE used `.where(eq(table.id, id))` without re-asserting `userId`. A future admin-action race could transfer the row between read and write.

Fix: WHERE clauses now `and(eq(table.id, id), eq(table.userId, session.user.id))`.

### I. TOCTOU on referral `maxUses`

Status: FIXED.

`apps/web/src/app/api/referrals/claim/route.ts` checked `maxUses` outside the transaction. Two concurrent claims could both pass the check and exceed the cap.

Fix: check is now inside the transaction with a `SELECT ... FOR UPDATE` lock on the referral row, or via `WHERE usage_count < max_uses` predicate on the UPDATE with rows-affected check.

### J. Raw error messages returned to clients

Status: FIXED (multiple endpoints).

- `/api/profile/import` returned `(err as Error).message` from `extractText` failures. Could expose internal paths or library internals. Fix: generic `'Could not process file'`.
- `/api/cover-letters/generate` returned `Generation failed: ${err.message}` with raw AI SDK messages that can include rate-limit detail or internal request IDs. Fix: generic `'Generation failed'`.
- `/api/health/ready` returned raw DB/Redis error messages publicly. Fix: returns `{ status: 'down' }` without the `error` field. The verbose form is logged server-side only.

### K. Broadcast emails sent to soft-deleted users (GDPR Art. 17)

Status: FIXED.

`/api/admin/broadcast/route.ts` filtered by `marketingOptIn: true` but not by `deletedAt`. Users in their 30-day soft-delete window kept receiving emails.

Fix: query now also requires `isNull(users.deletedAt)`.

### L. Admin analytics counted soft-deleted users

Status: FIXED.

`/api/admin/analytics/cohort` and `funnel` aggregated over all rows including soft-deleted users.

Fix: queries now filter `isNull(users.deletedAt)`.

### M. `audit_log.user_id` not nullified on hard-delete

Status: FIXED.

The 30-day purge cron hard-deleted users but left their `userId` linked in `audit_log` for up to a year. GDPR Art. 17 implies the link to the data subject should break at erasure.

Fix: purge cron now runs `UPDATE audit_log SET user_id = NULL WHERE user_id = ANY($purgedIds)` after the user delete.

### N. `userProfile` has no size bound in `/api/resumes/generate`

Status: FIXED.

`z.record(z.unknown())` accepted arbitrarily large objects. A user could send 50 KB of profile data and 20 KB of JD per request, inflating LLM token costs without hitting any cap besides the daily generation limit.

Fix: added a `JSON.stringify(body.userProfile).length` check returning 413 if >50 KB.

### O. Trivy container scan non-blocking

Status: FIXED.

`.github/workflows/deploy-gcp.yml` had `exit-code: '0'` on the Trivy container scan, allowing CRITICAL CVEs to ship.

Fix: `exit-code: '1'` with `severity: 'CRITICAL,HIGH'`.

### P. `:latest` tag pushed alongside SHA

Status: FIXED.

Risk of accidental `kubectl set image` pull of an unintended version.

Fix: only SHA tag is pushed. ArgoCD uses the SHA-bumped values file.

### Q. Race on concurrent deploys' `git push HEAD:main`

Status: FIXED.

Concurrent dev + prod deploys both checked out main, wrote different values files, pushed without rebase. Second push silently lost.

Fix: image-bump push step now does `git pull --rebase` in a small retry loop before `git push`.

---

## Important — operator action required

### R. Configure GitHub `production` environment

Status: OPERATOR.

`environment: production` is set on the `build-and-push` job, but GitHub requires the environment to be CONFIGURED in repo settings with required reviewers for the gate to have teeth. Without the config, the workflow runs without approval.

**You must:** Repo → Settings → Environments → New environment "production" → Required reviewers → add yourself. Repeat for "staging" if you want gating there too.

### S. AWS account ID + ACM certificate UUID in git history

Status: OPERATOR — accept the residual risk.

`857812839967` and ACM cert UUID `5866e9a6-d8fa-4ce3-b4b6-e52353836872` are committed in `docs/runbooks/github-actions-oidc-setup.md`, `infra/helm/resumaker/values.prod.yaml`, `scripts/validate-prerequisites.sh`. Not rotatable (account IDs are not secrets; cert UUIDs become irrelevant once AWS is decommissioned).

**You must:** decide if you're OK with these living in git history. If yes, no action. If no, `git filter-repo` to strip — but this rewrites history and breaks every clone.

### T. Personal email `rotem@avigdol.com` in code

Status: FIXED in this commit set, but history remains.

Replaced with `ops@resumaker.co.il` generic mailbox in Tofu defaults, resource tags, package.json author. The old email remains in git history.

**You must:** if you want history clean too, `git filter-repo --replace-text expressions.txt` to scrub. Otherwise the email stays in old commits.

### U. Sentry DSN rotation

Status: OPERATOR.

See finding D above.

### V. Cosign signing not wired

Status: DEFERRED.

`deploy-gcp.yml` builds images with SBOM + provenance attestations but does not cosign-sign them. Doc claims signing happens; workflow doesn't implement.

**Recommendation:** Add a `cosign sign --yes <image>` step using Workload Identity keyless signing after the `docker buildx build --push`. Post-launch hardening.

---

## Minor / defense-in-depth

### W. CSP `unsafe-inline` on `script-src`

Status: DEFERRED.

`apps/web/next.config.ts:48`. Largely defeats XSS mitigation via CSP. Documented as a known debt item in the code comment.

**Recommendation:** Adopt nonce-based CSP post-launch. Next.js supports this natively via Middleware + headers.

### X. SSRF bare-IP gap in JD parser

Status: FIXED.

`isPrivateHostname` blocked private CIDRs for named hosts via DNS pinning but a URL submitted as a bare IP like `http://0.1.2.3/` skipped the DNS lookup, allowing reserved-range addresses (0.0.0.0/8, 240.0.0.0/4, 100.64.0.0/10) through.

Fix: added `isPrivateOrReservedIp(...)` that runs on the bare-IP code path too.

### Y. `/api/hr/jobs/bulk-import` had no rate limit

Status: FIXED.

HR users could spam the 500-row CSV import endpoint.

Fix: added `checkRateLimit('hr-bulk-import:userId', 10, 3600)`.

### Z. `sentry.edge.config.ts` didn't run `scrubPii`

Status: FIXED.

Server config and observability had full PII scrubbing; edge runtime only stripped cookies/auth headers. A future middleware `captureException` with `extra: { email, ... }` would leak.

Fix: edge config now calls the same `scrubPii` pass.

### AA. `branch-protection` not codified

Status: OPERATOR.

Branch protection on `main` is manual via GitHub UI. Future-proof: use Tofu `github_branch_protection` resource.

**Recommendation:** post-launch, codify via the GitHub Tofu provider.

### BB. Single-region Secret Manager replication

Status: DEFERRED.

`infra/tofu/modules/gcp/secrets/main.tf` uses user-managed replication with one replica in `europe-west1`. If the region degrades, secrets become unavailable.

**Recommendation:** switch to `automatic` replication. Low priority unless multi-region DR is a stated requirement.

### CC. GKE control-plane endpoint has empty `master_authorized_networks_config`

Status: DEFERRED.

The block exists (added earlier) but contains no CIDR allowlist, so the API is publicly reachable (gated by GKE RBAC + gcloud auth, not network).

**Recommendation:** add your CI runner CIDR + a bastion CIDR post-launch. Not a launch blocker.

### DD. devDeps with moderate CVEs

Status: DEFERRED.

`esbuild ≤0.24.2` (GHSA-67mh-4wv8-2f99), `vite ≤6.4.1` (GHSA-4w7w-66w2-5vf9), `postcss <8.5.10` (GHSA-qx2v-qp2m-jg93). All transitive via `vitest` or `next`. Dev-only, not shipped to prod.

**Recommendation:** `pnpm update vitest` and bump Next.js minor when patches land.

---

## Things done well

- Cloud SQL has IAM auth, PITR, SSL-only, Query Insights enabled
- GKE Autopilot eliminates node-level credential exposure
- Pod security context: `readOnlyRootFilesystem`, `runAsNonRoot`, `allowPrivilegeEscalation: false`, `capabilities.drop: ALL`
- Network policies are default-deny with explicit IMDS block
- Dockerfile: multi-stage, non-root user, `HEALTHCHECK`, standalone output only
- Pre-commit hooks: secrets scan, IaC format/validate, YAML, Prettier
- All API routes audited: auth present, rate-limit present where needed, IDOR ownership clauses use `and(eq(id), eq(userId))` (where now made consistent everywhere)
- `hashIp()` uses HMAC-SHA256 with `IP_HASH_SALT` and refuses to store unsalted hashes
- Better-Auth `trustedOrigins` enforced; OAuth account linking restricted to verified Google only (no GitHub takeover via pre-claim)
- Soft-delete enforcement on all user-facing queries
- 30-day purge cron correctly hard-deletes + cascades
- Account deletion requires 15-min fresh session re-auth

---

## Operator action summary (from this audit)

1. **Rotate the Sentry DSN** (finding D).
2. **Configure GitHub `production` environment** with required reviewers (finding R).
3. **Decide on git-history scrub** for AWS account ID + personal email (findings S, T).
4. **Plan post-launch hardening** for cosign signing (V), CSP nonce (W), branch protection codification (AA), Secret Manager multi-region (BB), GKE control-plane allowlist (CC), devDep CVE bumps (DD).

Everything else is fixed in this commit set.
