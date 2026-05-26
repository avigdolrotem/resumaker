# Session — Production Readiness Pass (2026-05-26)

## TL;DR

Branch `feat/gcp-migration` is now **production-ready** for full-GCP launch. Vercel + Neon are entirely removed. 8 specialist review agents ran a security + QA audit; everything FIXED was fixed in two commits. Operator action list for launch is in [OPERATOR_HANDOFF.md](OPERATOR_HANDOFF.md) and [SECURITY_AUDIT_2026-05-26.md](SECURITY_AUDIT_2026-05-26.md).

26 commits on branch. All green:

- `pnpm -r typecheck` clean across 8 workspaces
- 17/17 vitest tests pass
- `tofu validate` ✅ on all 3 GCP envs
- `helm lint` ✅ on all 3 GCP value overlays
- Working tree clean

---

## What this session did

You said the Vercel + Neon accounts are being deleted, and asked for: code cleanup, full QA, DevOps alignment, security audit (try to break from outside), git-history scan, manual action list, admin-bootstrap mechanism, post-launch QA guide, API key rotation script.

### Pass 1 — Vercel/Neon removal + IaC hardening (`1003900`)

- **`apps/web/src/lib/env.ts`** — `GCP_CLOUD_SQL_INSTANCE` + `GCP_CLOUD_SQL_IAM_USER` are now REQUIRED. `DATABASE_URL` is optional (kept for local-only `psql` use).
- **`apps/web/src/db/index.ts`** — removed the Neon fallback branch; Cloud SQL Connector is unconditional.
- **`apps/web/src/lib/auth.ts`** — removed `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_BRANCH_URL` trustedOrigins loop.
- **Files deleted**: `vercel.json`, `.vercelignore`, `scripts/vercel-preview-setup.sh`, `docs/runbooks/vercel-preview-deploy.md`.
- **Tofu** — `workload-identity` module: Vercel OIDC provider + IAM binding + variables + outputs removed. All 3 GCP envs cleaned of `vercel_*` variables.
- **Tofu** — personal owner email (`rotem@avigdol.com`) replaced with `ops@resumaker.co.il` in defaults + resource tags.
- **`infra/helm/resumaker/values.staging-gcp.yaml`** — `NODE_ENV: production` + `APP_ENV: staging` (was `NODE_ENV: staging` which Next.js falls back to dev mode → stack-trace leak).
- **`infra/gitops/secrets/gcp-cluster-secret-store.yaml`** — added; GCP Secret Manager via Workload Identity (AWS one kept dormant for now).
- **`.github/workflows/deploy-gcp.yml`** — Trivy container scan is now BLOCKING (`exit-code: '1'`) on CRITICAL/HIGH. The `latest` tag push is also dropped (SHA-only).
- **FAQ page** + **vitest setup** — sanitized personal email, set CI test env vars for the new required Cloud SQL fields.
- **`scripts/rotate-secrets-gcp.sh`** — new. Interactive or batch JSON. Rotates any/all 13 secrets per env.
- **`scripts/grant-admin-gcp.sh`** — new. Tunnels Cloud SQL, runs `UPDATE users SET role='admin'`.
- **Docs added**: `POST_LAUNCH_QA.md`, `SECURITY_AUDIT_2026-05-26.md`. `OPERATOR_HANDOFF.md` extended with new tooling + manual steps list.

### Pass 2 — Application security fixes (`16103e3`)

12 fixes per the audit findings:

- **F** Email enumeration on `/api/account/email-change/request` → neutral 200 response.
- **G** Raw IPs in `tools/ats-scanner` + `salary-estimator` logs → `hashIp()` (GDPR fix).
- **H** TOCTOU on resume PATCH/DELETE → WHERE clauses now self-assert `userId` + rows-affected check.
- **I** TOCTOU on referral `maxUses` → conditional UPDATE inside transaction (`SELECT ... FOR UPDATE` semantics).
- **J** Raw error messages on `profile/import`, `cover-letters/generate`, `health/ready` → opaque error responses; verbose form logged server-side.
- **K** `/api/admin/broadcast` → `isNull(deletedAt)` filter (GDPR Art. 17 — no marketing to deleted users).
- **L** `/api/admin/analytics/{cohort,funnel}` → `isNull(deletedAt)` filter.
- **M** `/api/cron/purge` → nullifies `audit_log.user_id` on hard-delete (data-subject unlinkability).
- **N** `/api/resumes/generate` → 50 KB cap on `userProfile` to bound LLM cost.
- **I-5** `sentry.edge.config.ts` → full PII scrub matching server config.
- **X** JD parser bare-IP SSRF gap → added `0.0.0.0/8` and `240.0.0.0/4` blocking.
- **Y** `/api/hr/jobs/bulk-import` → rate-limit 10/hr/user.

---

## Audit-finding status (read [SECURITY_AUDIT_2026-05-26.md](SECURITY_AUDIT_2026-05-26.md) for full detail)

### Critical — all FIXED

- Missing `ExternalSecret` Helm template
- Heredoc YAML in `deploy-gcp.yml`
- `DATABASE_URL` unconditionally required
- `NODE_ENV: staging` invalid

### Operator must act (these are NOT fixed in code)

- **Rotate the Sentry DSN** — `dd977b...` is in `docs/runbooks/github-actions-oidc-setup.md` at commit `adbba50`. Rotate in Sentry dashboard, then `gcloud secrets versions add sentry-dsn --data-file=- --project=resumaker-prod`.
- **Configure GitHub `production` environment with required reviewers** — repo Settings → Environments → New → "production" → add yourself.
- **(Optional) `git filter-repo` to scrub history** — for the personal email + AWS account ID. Rewrites all history; breaks every existing clone. Skip if you don't care.

### Deferred — post-launch

- Cosign keyless image signing in `deploy-gcp.yml`
- CSP nonce instead of `unsafe-inline`
- GKE control-plane CIDR allowlist (bastion + CI runner)
- Secret Manager multi-region replication
- Branch protection codified via Tofu github provider
- Bump devDep CVEs (`esbuild`, `vite`, `postcss`)

---

## What's left for you to do (numbered, in launch order)

1. **Rotate the Sentry DSN** (Sentry dashboard → Settings → Client Keys → Rotate).
2. **Provision API keys** for all 13 secrets (see `OPERATOR_HANDOFF.md` §5 for vendor URLs).
3. **Configure GitHub `production` environment** with required reviewers.
4. **Push both branches** + open PRs (`feat/multi-ai-3a` first, then `feat/gcp-migration`).
5. **Install gcloud + tofu + cloud-sql-proxy** locally (`OPERATOR_HANDOFF.md` §2).
6. **Run `bootstrap.sh`** for all 3 envs (creates GCP projects + state buckets).
7. **`tofu apply`** dev → staging → prod (`OPERATOR_HANDOFF.md` §7).
8. **`./scripts/rotate-secrets-gcp.sh <env>`** to push the 13 secret values to each env.
9. **Run schema migrations** via `cloud-sql-proxy` tunnel (`OPERATOR_HANDOFF.md` §7.5).
10. **Tag a release** (`git tag v1.0.0 && git push origin v1.0.0`) → `deploy-gcp.yml` builds + pushes + bumps Helm values → ArgoCD rolls out.
11. **Sign up via the running app**, then `./scripts/grant-admin-gcp.sh prod you@example.com` to promote yourself.
12. **Update Cloudflare DNS** A record from Vercel to the GKE Ingress IP.
13. **Wait for `ManagedCertificate`** to reach `Active` (15-60 min).
14. **Run `docs/POST_LAUNCH_QA.md`** end-to-end before announcing launch.
15. **Set GCP Budget alerts** at 50% / 75% / 90% per project.
16. **Delete the Vercel and Neon accounts.**

Estimated total operator time: **3-4 hours** spread over 1-2 days.

---

## Branch summary

| Branch               | Commits | Status                                                                                        |
| -------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `feat/multi-ai-3a`   | 21      | Multi-AI provider abstraction. Ready to merge.                                                |
| `feat/gcp-migration` | 26      | Full-GCP IaC + cleanup + security hardening. Ready to merge. 3 critical fixes for production. |

Both branches are local-only (unpushed). Push with `git push -u origin feat/multi-ai-3a feat/gcp-migration` when ready.

---

## Files added this session

```
docs/
  POST_LAUNCH_QA.md                          (529 lines)  — per-user-type QA walkthrough
  SECURITY_AUDIT_2026-05-26.md               (~300 lines) — 8-agent audit findings + status
  SESSION_2026-05-26-PRODUCTION_READINESS.md (this file)  — what changed and what's next
scripts/
  rotate-secrets-gcp.sh                                   — rotate any/all 13 secrets
  grant-admin-gcp.sh                                      — promote a user to admin
infra/gitops/secrets/
  gcp-cluster-secret-store.yaml                           — GCP Secret Manager ESO store
infra/helm/resumaker/templates/
  externalsecret.yaml                                     — ExternalSecret CRDs (was missing!)
```

---

## How the audit was conducted

Eight specialist subagents ran in parallel, read-only:

1. **Git history scan** — found Sentry DSN, AWS account ID, personal email in history.
2. **Vercel/Neon mapping** — full inventory of all references to remove.
3. **Dead code sweep** — found a handful of unused exports + 2 commented-block sites; nothing critical to delete pre-launch.
4. **SAST + dep audit** — found TOCTOU on resumes + referrals, error leakage, 3 dev-only CVEs.
5. **External attack surface review** — verified 75 routes; found 4 important issues (now fixed); confirmed strong baseline.
6. **PII + privacy review** — found GDPR violations (raw IP logs, email enumeration, broadcast to deleted users, audit_log link); all fixed.
7. **DevOps alignment** — scored 11 dimensions; found 3 critical (Trivy non-blocking, missing GCP ClusterSecretStore, missing cosign — first two fixed, cosign deferred).
8. **Comprehensive code review** — found 3 production blockers I'd missed (missing ExternalSecret template, broken heredoc YAML, DATABASE_URL still required); all fixed.

Two implementation subagents then applied the fixes serially. Final verification showed everything green.

— Session ended 2026-05-26 at production-ready state.
