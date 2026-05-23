# Architecture

## Overview

Resumaker is a microservices-based AI resume builder targeting the Israeli job market. The system accepts a job description (paste or URL), generates a tailored resume using an LLM, and scores it against ATS-style keyword matching. Hebrew is the primary language with English as a secondary option.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                          User                                │
│                  (Desktop / Mobile / Tablet)                 │
└────────────────────┬─────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌──────────────────────────────────────────────────────────────┐
│                     Cloudflare                               │
│     • DNS                                                    │
│     • CDN & DDoS protection                                  │
│     • WAF (free tier)                                        │
│     • Bot challenge for /api/*                               │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              Vercel — Frontend Edge                          │
│  Next.js 16 App Router (RSC)                                 │
│  • Hebrew (RTL) / English (LTR) routing                      │
│  • Server Components for marketing pages                     │
│  • Edge functions for auth callbacks                         │
└────────────────────┬─────────────────────────────────────────┘
                     │ HTTPS / Better Auth session
                     ▼
┌──────────────────────────────────────────────────────────────┐
│            AWS API Gateway (il-central-1)                    │
│  • Rate limiting (per-user, per-IP)                          │
│  • API key auth for service-to-service                       │
│  • CORS & origin enforcement                                 │
└────────────────────┬─────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬────────────┬───────────┐
        ▼            ▼            ▼            ▼           ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────┐
   │  Auth   │  │ Resume  │  │   ATS   │  │   JD    │  │Billing│
   │ Service │  │Generator│  │ Scorer  │  │ Parser  │  │       │
   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └──┬───┘
        │            │             │            │           │
        │       ┌────▼─────────────▼────┐       │           │
        │       │   AI Safety Layer     │       │           │
        │       │  • Prompt injection   │       │           │
        │       │  • Input sanitization │       │           │
        │       │  • Output validation  │       │           │
        │       └──────────┬────────────┘       │           │
        │                  │                    │           │
        │       ┌──────────▼─────────┐          │           │
        │       │  LLM Orchestrator  │          │           │
        │       │  • Claude (default)│          │           │
        │       │  • GPT-5 (premium) │          │           │
        │       │  • Gemini (premium)│          │           │
        │       └────────────────────┘          │           │
        │                                       │           │
   ┌────▼──────────────────────────────────────▼───────────▼─┐
   │              Postgres (AWS RDS)                          │
   │   users · resumes · job_descriptions · subscriptions     │
   │   · generations · scores · audit_log                     │
   └──────────────────────────────────────────────────────────┘
                     │
                     ▼
   ┌──────────────────────────────────────────────────────────┐
   │   Redis (ElastiCache)      S3 (resume files, exports)    │
   └──────────────────────────────────────────────────────────┘
```

## Service Boundaries

### 1. Frontend (`apps/web`)

**Tech**: Next.js 16, TypeScript, Tailwind v4, shadcn/ui, Aceternity UI
**Responsibilities**:

- All user-facing UI (Hebrew RTL primary, English LTR secondary)
- Server Components for static/marketing pages
- Client Components for editor, preview, dashboard
- Session management via Better Auth client
- Renders resumes via React-PDF (both preview and download)

### 2. Auth Service (within `apps/web` and `apps/api/auth`)

**Tech**: Better Auth, Postgres
**Responsibilities**:

- Email + password registration with verification
- OAuth (Google, GitHub)
- Magic link login
- TOTP 2FA
- Session management (DB-backed)
- Organization/team support (for future enterprise tier)

### 3. Resume Generator (`apps/api/resume-generator`)

**Tech**: Node.js (Hono), Vercel AI SDK, Postgres
**Responsibilities**:

- Receives sanitized JD + user profile
- Routes to AI Safety Layer
- Calls appropriate LLM via orchestrator
- Validates output against Zod schema
- Persists generation in DB
- Returns structured resume JSON

### 4. AI Safety Layer (`packages/ai-safety`)

**Tech**: TypeScript library, used by all LLM-touching services
**Responsibilities**:

- Strip prompt injection patterns
- Enforce input length limits
- Validate output schema
- Rate limit by user/IP
- Audit logging
- See [AI_SAFETY.md](AI_SAFETY.md)

### 5. ATS Scorer (`apps/api/ats-scorer`)

**Tech**: Node.js, custom matching algorithm + LLM verification
**Responsibilities**:

- Extract keywords from JD
- Compare against generated resume
- Score (0-100) + missing keywords list
- Suggest improvements

### 6. JD Parser (`apps/api/jd-parser`)

**Tech**: Node.js, Playwright headless, Firecrawl (optional)
**Responsibilities**:

- Accept text paste
- Accept URL → fetch + extract content
- Strip ads/navigation
- Detect language (Hebrew/English/other)
- Pass clean text to other services

### 7. Billing Service (`apps/api/billing`)

**Tech**: Node.js, Stripe SDK
**Responsibilities**:

- Subscription management (infrastructure only at launch)
- Webhook handling
- Usage metering
- Entitlement checks

## Data Flow: Generate Resume

```
1. User pastes JD or URL on frontend
       │
       ▼
2. Frontend POST /api/resumes/generate
       │
       ▼
3. API Gateway: auth check + rate limit
       │
       ▼
4. JD Parser:
   • If URL: fetch via Playwright/Firecrawl
   • Detect language (he/en/other)
   • Strip noise, normalize whitespace
       │
       ▼
5. AI Safety Layer (input):
   • Length check (<20K chars)
   • Strip injection patterns
   • Log fingerprint
       │
       ▼
6. Resume Generator:
   • Load user profile from DB
   • Build LLM prompt (system + user message separation)
   • Call Claude Sonnet via AI SDK
       │
       ▼
7. AI Safety Layer (output):
   • JSON schema validation
   • Refuse if injection detected in output
       │
       ▼
8. Persist to DB:
   • generations table (audit trail)
   • resumes table (latest version)
       │
       ▼
9. ATS Scorer:
   • Extract JD keywords
   • Match against resume
   • Compute score
       │
       ▼
10. Return to frontend:
    • Resume JSON
    • ATS score + missing keywords
    • Suggestions
       │
       ▼
11. Frontend renders via React-PDF in browser
```

## Deployment Architecture

### Environments

There is no local-dev environment by design — all development happens
against production (single-environment deployment model).

| Environment    | Frontend / Backend               | Database                 | Cache               | LLM           |
| -------------- | -------------------------------- | ------------------------ | ------------------- | ------------- |
| **CI**         | Vitest in GitHub Actions         | mocked                   | mocked              | mocked        |
| **Production** | EKS in `il-central-1` (Tel Aviv) | RDS Postgres 17 multi-AZ | ElastiCache Redis 7 | Anthropic API |

Cloudflare sits in front of the public ALB for DDoS mitigation,
caching of static assets, and origin-IP hiding.

## Cross-Cutting Concerns

| Concern           | Implementation                                                          |
| ----------------- | ----------------------------------------------------------------------- |
| **Observability** | OpenTelemetry → Grafana/Prometheus/Loki on EKS, Sentry for errors       |
| **Secrets**       | AWS Secrets Manager (prod), `/Volumes/Server_Data/secrets/` (local dev) |
| **Tracing**       | OTel distributed traces across all services                             |
| **Logging**       | Structured JSON logs, correlation IDs                                   |
| **Caching**       | Redis for: rate limits, JD parse results, ATS computations              |
| **Idempotency**   | All POST endpoints use idempotency keys                                 |
| **Encryption**    | TLS 1.3 everywhere, AES-256 at rest                                     |
| **Compliance**    | Israeli Privacy Law of 1981 (updated 2024), GDPR-compatible             |

## Scalability Targets (V1)

| Metric                 | Target |
| ---------------------- | ------ |
| Concurrent users       | 1,000  |
| Resume generations/min | 100    |
| P95 latency (UI)       | <300ms |
| P95 latency (LLM call) | <8s    |
| Uptime SLO             | 99.5%  |

## Design Principles

1. **Hebrew-first, English-second** — RTL is the default, not an afterthought
2. **AI is the product, safety is the moat** — Prompt injection defense is non-negotiable
3. **Microservices for portfolio, monolith-first for speed** — Start logically separate, optimize boundaries later
4. **Type safety end-to-end** — TypeScript strict mode, Zod for all I/O
5. **Infrastructure as code** — Nothing manual in production. Everything in OpenTofu.
6. **Cost-conscious by default** — Free tier where possible, scale paid services with demand

## Related Documents

- [STACK.md](STACK.md) — Technology choices and trade-offs
- [SECURITY.md](SECURITY.md) — Threat model and controls
- [AI_SAFETY.md](AI_SAFETY.md) — LLM safety layer detail
- [INFRASTRUCTURE.md](INFRASTRUCTURE.md) — AWS deployment design
- [AUTH.md](AUTH.md) — Authentication & authorization
- [MICROSERVICES.md](MICROSERVICES.md) — Service boundary detail
- [DEVOPS.md](DEVOPS.md) — CI/CD and operational practices
