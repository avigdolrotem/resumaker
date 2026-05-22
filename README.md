# Resumaker

> Hebrew-first AI resume builder with ATS optimization. Generate tailored resumes from job descriptions using LLMs, with security and accessibility baked in.

[![CI](https://github.com/rotem/resumaker/actions/workflows/ci.yml/badge.svg)](https://github.com/rotem/resumaker/actions/workflows/ci.yml)
[![Security](https://github.com/rotem/resumaker/actions/workflows/security.yml/badge.svg)](https://github.com/rotem/resumaker/actions/workflows/security.yml)
[![License: BUSL 1.1](https://img.shields.io/badge/license-BUSL%201.1-orange.svg)](LICENSE)

## What This Is

Resumaker is a production resume builder targeted at the Israeli job market. Paste a job description (or URL), get back an ATS-optimized resume tailored to that role, available in Hebrew or English with automatic language detection. Built on a microservices architecture with industry-grade DevOps practices.

## Highlights

- 🇮🇱 **Hebrew-first with RTL support** — built for the Israeli market
- 🧠 **LLM-powered generation** with strict prompt-injection defense
- 📊 **ATS scoring** — see how well your resume matches the job description
- 🏭 **Industry presets** — Tech / Healthcare / Finance / General templates
- 🎨 **5 custom-designed templates** with React-PDF rendering
- 🔐 **Better Auth** with email + OAuth + 2FA + passkeys
- 💳 **Stripe-ready** subscription infrastructure
- ☁️ **AWS infrastructure** defined as code (OpenTofu)
- 🔒 **Security-first** — gitleaks, trivy, OWASP Top 10 hardening
- 🌐 **Cloud-native** — Docker, Kubernetes (EKS), Helm, ArgoCD

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full picture.

Quick view:

```
Browser → Cloudflare → Next.js (Vercel) → API Gateway →
   ├─ Better Auth (sessions, OAuth, MFA)
   ├─ Resume Generator Service (LLM orchestrator + safety layer)
   ├─ ATS Scorer Service
   ├─ Job Description Parser (paste + URL fetch)
   ├─ Billing Service (Stripe)
   └─ Postgres (RDS) + S3 (resumes) + Redis (rate limits)
```

## Tech Stack

| Layer      | Choice                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| Frontend   | Next.js 16, TypeScript, Tailwind v4, shadcn/ui, Aceternity UI, next-intl |
| Backend    | Node.js, Hono/Fastify, microservices                                     |
| Database   | PostgreSQL (AWS RDS) + Redis (ElastiCache)                               |
| Auth       | Better Auth                                                              |
| AI         | Claude Sonnet (default), Gemini, GPT-5 (premium tier)                    |
| Storage    | AWS S3                                                                   |
| Infra      | AWS (il-central-1) via OpenTofu                                          |
| Containers | Docker + EKS + Helm                                                      |
| GitOps     | ArgoCD                                                                   |
| CI/CD      | GitHub Actions                                                           |
| Monitoring | Sentry + Grafana + Prometheus + Loki                                     |
| Payments   | Stripe                                                                   |

## Project Structure

```
resumaker/
├── apps/
│   ├── web/              # Next.js 16 frontend (HE/EN i18n)
│   └── api/              # Backend services
├── packages/
│   ├── shared/           # Shared types, Zod schemas
│   ├── ui/               # Reusable UI components
│   ├── ai-safety/        # LLM prompt injection defense
│   ├── resume-engine/    # Resume generation logic
│   └── ats-scorer/       # ATS keyword scoring
├── infra/
│   ├── tofu/             # OpenTofu IaC (AWS)
│   ├── ansible/          # Config management
│   └── helm/             # Kubernetes charts
├── docs/                 # Architecture & design docs
├── scripts/              # Build & deploy automation
├── tests/                # E2E, integration, security tests
└── .github/workflows/    # CI/CD pipelines
```

## Getting Started

See [docs/SETUP.md](docs/SETUP.md) for the complete setup guide.

```bash
# Prerequisites: Node 20+, pnpm 9+, Docker, AWS CLI configured
pnpm install
pnpm dev
```

## Documentation

| Document                                    | Purpose                               |
| ------------------------------------------- | ------------------------------------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)     | System architecture and data flow     |
| [STACK.md](docs/STACK.md)                   | Technology choices and trade-offs     |
| [SECURITY.md](docs/SECURITY.md)             | Security model and threat analysis    |
| [AI_SAFETY.md](docs/AI_SAFETY.md)           | LLM safety layer design               |
| [INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | AWS infrastructure details            |
| [AUTH.md](docs/AUTH.md)                     | Authentication & authorization design |
| [MICROSERVICES.md](docs/MICROSERVICES.md)   | Service boundaries & communication    |
| [DEVOPS.md](docs/DEVOPS.md)                 | CI/CD and operational practices       |
| [SETUP.md](docs/SETUP.md)                   | Local development setup               |

## License

Resumaker™ is source-available under the **Business Source License 1.1** — see [LICENSE](LICENSE).

In short: you may read, fork, modify, and run this code for non-production purposes. You may not offer it to third parties as a hosted or embedded service that competes with the commercial version. Four years after each release, the code converts to the Apache License 2.0.

For commercial / competitive use licensing, contact <licensing@resumaker.co.il>.

## Author

Built by [Rotem Avigdol](https://avigdol.com) as both a production service and portfolio piece demonstrating modern full-stack and DevOps practices.
