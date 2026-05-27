# Changelog

All notable changes to Resumaker are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [v0.1.0] — 2026-05-27

First public-cluster-shaped release. Pre-launch: not yet served to end users,
but the Israeli production GKE cluster at `https://resumaker.co.il` is live with
3/3 pods Ready behind a Google-managed cert. Two container images shipped to
Artifact Registry during this window: `v0.0.2-e34ab5d`, `v0.0.3-e34ab5d`.

### Added

- **Multi-provider LLM picker (Settings → AI engine).** Plus and Pro tiers can
  now choose between Claude Haiku, Sonnet, and Opus, plus Gemini 2.5 Pro and
  GPT-5. Free stays on Claude Haiku. Selection is per-user and persisted in
  the `users.llm_model` column. (PR #1)
- **`GET` / `PATCH /api/user/llm-model`** endpoints backing the picker, with
  tier gating and graceful fallback when a user's preferred model is
  unavailable. (PR #1)
- **Vertex AI as the production LLM path.** Claude and Gemini are now routed
  through Google Cloud Vertex AI using Application Default Credentials and
  Workload Identity — no API keys in env. (PR #8)
- **Hebrew + English copy** for the new AI-engine settings tab. (PR #1)
- **Full-GCP production infrastructure.** Eight new OpenTofu modules wire up
  GKE Autopilot (web + workers + cron), Cloud SQL Postgres, Memorystore Redis,
  GCS buckets, Artifact Registry, Secret Manager, VPC + Cloud NAT + Private
  Services Access, and Workload Identity Federation for GitHub Actions OIDC.
  Three environments validate clean: dev, staging, prod. (PR #3)
- **End-to-end GCP deploy pipeline.** `.github/workflows/deploy-gcp.yml`
  builds and pushes images to Artifact Registry, then triggers ArgoCD sync.
  Helm overlays for dev/staging/prod with GKE Ingress, ExternalSecrets, and
  Workload Identity SA annotations. (PR #3)
- **Operator bootstrap scripts.** `bootstrap-gcp.sh` provisions the Tofu
  state bucket + WIF + base service accounts. `rotate-secrets-gcp.sh`
  populates Secret Manager. `grant-admin-gcp.sh` handles IAM admin grants.
  (PR #3)
- **Google-managed certificate** Helm template for the production Ingress.
  (PR #6)
- **Container image** with build-time env stubs so `next build` survives
  production-mode Zod env parsing. (PR #7, PR #8)
- **Operator handoff documentation** (`docs/OPERATOR_HANDOFF.md`, 616 lines)
  covering manual cutover steps and IaC-vs-cluster divergences. (PR #3, PR #7,
  PR #8)
- **Post-launch QA + security audit docs** (`POST_LAUNCH_QA.md`,
  `SECURITY_AUDIT_2026-05-26.md`). (PR #3)

### Changed

- **Entire LLM surface migrated** from direct `@anthropic-ai/sdk` calls to a
  provider-agnostic wrapper. Resume generation, PDF/TXT resume import, bullet
  rewrite, fit-score, application prep, and follow-up routes all flow through
  one place — making model selection, fallback, and rate-limit handling
  consistent. The fit-score and resume-import paths now use structured
  `generateObject` calls instead of freeform JSON parsing. (PR #1)
- **Production database access** now uses `DATABASE_URL` against Cloud SQL's
  private IP, as a live workaround for Cloud SQL Connector breaking at
  runtime in the container image. (PR #8 — operator follow-up tracked to
  restore IAM-authenticated Connector path)
- **Email verification is now required unconditionally** before account
  activation. (PR #8)
- **Cloud SQL connection pooling** tuned with `idle_timeout`, `max_lifetime`,
  and `connect_timeout` so Cloud SQL's idle-kill no longer surfaces as
  runtime errors to users. (PR #9)
- **Vertex AI calls** now respect the `LLM_TIMEOUT_MS` env var via
  `AbortSignal.timeout` (was previously dead config). (PR #9)
- **CI runs unblocked.** Dropped the redundant `with: version` from
  `pnpm/action-setup@v4` invocations across `ci.yml` and `security.yml`;
  the action now auto-detects from `package.json#packageManager` and CI no
  longer fails in the first second of `Install dependencies`. (PR #2)

### Fixed

- **SSRF in job-description importer.** `packages/job-engine/src/importer.ts`
  now DNS-resolves URLs, blocks private IP ranges, walks redirects manually,
  and caps response bodies at 5 MB. (PR #9)
- **LLM model PATCH rejected real model IDs** because the validation regex
  did not allow the `@` character used in versioned identifiers like
  `anthropic/claude-sonnet-4-6@20251001`. (PR #9)
- **`/api/applications/[id]/prep` 502s every call** — route was passing a
  truncated model identifier to Vertex. (PR #9)
- **`/api/applications/[id]/follow-up` 502s every call** — same root cause
  as prep. (PR #9)
- **Job-engine defaults rejected by Vertex Anthropic with a 400** — model
  strings now include the required `@date` suffix. (PR #9)
- **IDOR in `DELETE /api/applications/[id]` and `/api/cover-letters/[id]`** —
  any authenticated user could delete another user's records. `userId` is
  now re-asserted in the `WHERE` clause. (PR #5)
- **IDOR in push-notification unsubscribe** — any authed user could
  unsubscribe anyone. (PR #9)
- **TOCTOU on resume version snapshot + restore.** Both SQL paths now defend
  against the race. (PR #9)
- **Cover-letter prompt injection** returned uncaught 500; now returns a
  clean 400. (PR #5)
- **Admin tier-grant flow** now requires a fresh session (≤15 min). (PR #9)
- **Three soft-delete filter omissions fixed** in profile derivation, admin
  funnel, and dashboard ATS stats — deleted users no longer appear in
  aggregates or admin views. (PR #9)
- **`master_authorized_networks` and Workload Identity binding** wired so
  the first deploy can actually reach the GKE control plane and pods can
  authenticate as their KSA. (PR #6)
- **NetworkPolicy CIDRs** moved from hard-coded values into the Helm chart
  with per-env templating. (PR #6)

### Security

- **Cron endpoints use timing-safe comparison** for `CRON_SECRET` via a
  shared helper — no more length-leak side channel. (PR #6)
- **PII scrubbed before stdout + Sentry** by the observability logger.
  Dev-mode email logs now redact recipient and drop the message body
  entirely. (PR #5)
- **Hardened HTTP response headers** — added Cross-Origin-Opener-Policy
  (COOP), Cross-Origin-Resource-Policy (CORP), and expanded the
  Permissions-Policy allowlist. (PR #5)
- **Theme cookie carries the `Secure` flag** on HTTPS origins. (PR #5)
- **Schema unique constraints + webhook hardening** to close double-submit
  and replay vectors. (PR #3)
- **LLM input sanitization** layered in before prompts hit the provider.
  (PR #3)
- **Sentry hygiene** — stack traces and user identifiers are stripped of
  payment-sensitive fields before upload. (PR #3)
- **4 moderate transitive CVEs** in the dev dependency chain (`vite`,
  `postcss`) addressed. (PR #5)

### Removed

- **Vercel** as a production deploy target. The full-GCP pivot supersedes
  the `Vercel + Neon dev-only` setup. (PR #3, PR #4)
- **Neon** as the production database. Cloud SQL Postgres replaces it.
  (PR #3, PR #4)
- **All AWS modules and references** from active OpenTofu configuration —
  `infra/tofu/modules/s3/`, RDS, Secrets Manager, ElastiCache, EKS,
  `il-central-1` artifacts, ALB ingress, etc. AWS code remains only in
  historical docs. (PR #4)
- **`@anthropic-ai/sdk` dependency** removed from `apps/web` and
  `packages/job-engine` — all LLM traffic goes through the provider
  wrapper. (PR #1)
- **`@ai-sdk/gateway` package** dropped in favor of `@ai-sdk/google-vertex`
  for the production LLM path. (PR #8)
- **Dead environment variables** `ANTHROPIC_API_KEY`, `AWS_*`, and
  `AI_GATEWAY_API_KEY` removed from `.env.example`; replaced with
  `GOOGLE_VERTEX_*`. (PR #8)

[Unreleased]: https://github.com/avigdolrotem/resumaker/compare/v0.1.0...HEAD
[v0.1.0]: https://github.com/avigdolrotem/resumaker/releases/tag/v0.1.0
