# Resumaker

> Hebrew-first AI resume builder with ATS optimization. Generate tailored resumes from job descriptions using LLMs, with security and accessibility baked in.

[![CI](https://github.com/avigdolrotem/resumaker/actions/workflows/ci.yml/badge.svg)](https://github.com/avigdolrotem/resumaker/actions/workflows/ci.yml)
[![Security](https://github.com/avigdolrotem/resumaker/actions/workflows/security.yml/badge.svg)](https://github.com/avigdolrotem/resumaker/actions/workflows/security.yml)
[![License: BUSL 1.1](https://img.shields.io/badge/license-BUSL%201.1-orange.svg)](LICENSE)

## What This Is

Resumaker is a production resume builder targeted at the Israeli job market. Paste a job description (or URL), get back an ATS-optimized resume tailored to that role, available in Hebrew or English with automatic language detection. Built as a single Next.js deployment (the `packages/*` workspaces below are in-process libraries, not separate services) with industry-grade DevOps practices.

## Highlights

- 🇮🇱 **Hebrew-first with RTL support** — built for the Israeli market
- 🧠 **LLM-powered generation** with strict prompt-injection defense
- 📊 **ATS scoring** — see how well your resume matches the job description
- 🏭 **Industry presets** — Tech / Healthcare / Finance / General templates
- 🎨 **5 custom-designed templates** with React-PDF rendering
- 🔐 **Better Auth** with email + OAuth + 2FA + passkeys
- 💳 **Stripe-ready** subscription infrastructure
- ☁️ **GCP infrastructure** defined as code (OpenTofu)
- 🔒 **Security-first** — gitleaks, trivy, OWASP Top 10 hardening
- 🌐 **Cloud-native** — Docker, Kubernetes (GKE), Helm

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — note: that doc predates the
AWS→GCP migration (see `docs/superpowers/plans/2026-05-26-gcp-migration.md`)
and still describes an earlier Vercel/AWS/microservices design. Treat the
diagram below and `infra/` (OpenTofu + Helm) as the source of truth until
ARCHITECTURE.md gets a proper rewrite.

Quick view:

```
Browser → Cloudflare → Next.js (GKE, single deployment) → Better Auth (sessions, OAuth, MFA)
   ├─ Resume generation (LLM orchestrator + safety layer, in-process)
   ├─ ATS scoring
   ├─ Job description parsing (paste + URL fetch)
   ├─ Billing (Stripe / Lemon Squeezy)
   └─ Cloud SQL (Postgres) + Memorystore (Redis) + GCS (file storage)
```

## Tech Stack

| Layer      | Choice                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------- |
| Frontend   | Next.js 16, TypeScript, Tailwind v4, shadcn/ui, next-intl                                       |
| Backend    | Next.js API routes (single deployment; `packages/*` are in-process libs, not separate services) |
| Database   | PostgreSQL (Cloud SQL) + Redis (Memorystore)                                                    |
| Auth       | Better Auth                                                                                     |
| AI         | Claude Sonnet (default), Gemini, GPT-5 (premium tier)                                           |
| Storage    | Google Cloud Storage (GCS)                                                                      |
| Infra      | GCP (europe-west1) via OpenTofu                                                                 |
| Containers | Docker + GKE + Helm                                                                             |
| GitOps     | ArgoCD                                                                                          |
| CI/CD      | GitHub Actions                                                                                  |
| Monitoring | Sentry + Grafana + Prometheus + Loki                                                            |
| Payments   | Stripe + Lemon Squeezy                                                                          |

## Project Structure

```
resumaker/
├── apps/
│   ├── web/              # Next.js 16 app — frontend + all API routes (HE/EN i18n)
│   └── api/              # Empty — not in use
├── packages/
│   ├── shared/           # Shared types, Zod schemas
│   ├── ai-safety/        # LLM prompt injection defense
│   ├── job-engine/       # Job description parsing
│   ├── resume-engine/    # Resume generation logic
│   └── ats-scorer/       # ATS keyword scoring
├── infra/
│   ├── tofu/             # OpenTofu IaC (GCP)
│   ├── ansible/          # Config management
│   ├── helm/             # Kubernetes charts
│   └── gitops/           # ArgoCD manifests (dormant — see deploy.yml)
├── docs/                 # Architecture & design docs
├── scripts/              # Build & deploy automation
├── tests/                # E2E, integration, security tests
└── .github/workflows/    # CI/CD pipelines
```

## Getting Started

```bash
# Install deps + run tests + typecheck
pnpm install
pnpm -r test && pnpm -r typecheck

# Run the web app locally (needs a reachable Postgres + Redis — see
# apps/web/.env.example for the variables env.ts requires)
pnpm dev
```

**Deploying is a manual step, not automatic.** Pushing a `v*.*.*` tag (or
running the `Deploy (GCP)` workflow manually) builds, scans, and pushes a
container image to Artifact Registry — it does **not** roll it out.
ArgoCD isn't installed yet (`infra/gitops/` is dormant until repo variable
`ARGOCD_ENABLED=true`), and the GKE control plane is IP-allowlisted to the
operator's network, so a GitHub-hosted runner can't reach it either. The
image-build job prints the exact `helm upgrade` command to run from an
allowlisted host — see `.github/workflows/deploy.yml` and
[docs/PRE_LAUNCH.md](docs/PRE_LAUNCH.md) for the full checklist.

## Documentation

| Document                                    | Purpose                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| [PRE_LAUNCH.md](docs/PRE_LAUNCH.md)         | Step-by-step launch checklist                                                   |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)     | System architecture and data flow                                               |
| [STACK.md](docs/STACK.md)                   | Technology choices and trade-offs                                               |
| [SECURITY.md](docs/SECURITY.md)             | Security model and threat analysis                                              |
| [AI_SAFETY.md](docs/AI_SAFETY.md)           | LLM safety layer design                                                         |
| [INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | Infrastructure details (⚠️ pre-GCP-migration, stale — see `infra/` for current) |
| [AUTH.md](docs/AUTH.md)                     | Authentication & authorization design                                           |
| [MICROSERVICES.md](docs/MICROSERVICES.md)   | ⚠️ Describes an earlier microservices design not reflected in this codebase     |
| [DEVOPS.md](docs/DEVOPS.md)                 | CI/CD and operational practices                                                 |
| [runbooks/](docs/runbooks/)                 | On-call playbooks                                                               |

## License

Resumaker™ is source-available under the **Business Source License 1.1** — see [LICENSE](LICENSE).

In short: you may read, fork, modify, and run this code for non-production purposes. You may not offer it to third parties as a hosted or embedded service that competes with the commercial version. Four years after each release, the code converts to the Apache License 2.0.

For commercial / competitive use licensing, contact <licensing@resumaker.co.il>.

## Author

Built by [Rotem Avigdol](https://avigdol.com) as both a production service and portfolio piece demonstrating modern full-stack and DevOps practices.
