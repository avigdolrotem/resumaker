# Technology Stack

Every choice with its reasoning and the alternatives we rejected.

## Frontend

### Next.js 16 (App Router)
**Why**: Best-in-class React framework with server components, edge functions, and Vercel hosting integration. App Router gives us streaming + RSC.
**Rejected alternatives**:
- **Remix/React Router 7** — smaller ecosystem, less Vercel-native
- **SvelteKit** — smaller talent pool, less portfolio recognition
- **Pure React + Vite** — too much custom config for our needs

### TypeScript (strict mode)
**Why**: Type safety prevents whole classes of bugs. Strict mode enforces good habits.
**Rejected alternatives**: Plain JS (rejected for portfolio quality)

### Tailwind v4 + shadcn/ui
**Why**: Tailwind for utility classes, shadcn/ui for unstyled accessible components we own. Both excel at RTL support via logical properties.
**Rejected alternatives**:
- **MUI** — too opinionated, heavy bundle, Hebrew RTL bugs
- **Chakra** — losing momentum, MUI same issues
- **Vanilla CSS modules** — too slow to iterate

### next-intl (i18n)
**Why**: Most modern Next.js i18n library, App Router support, type-safe message catalogs.
**Rejected alternatives**:
- **next-i18next** — older, Pages Router focused
- **react-intl** — heavier, less Next-integrated

### React Hook Form + Zod
**Why**: Performance (uncontrolled forms), type-safe validation, schema reuse on backend.
**Rejected alternatives**:
- **Formik** — re-renders entire form on every keystroke
- **React Final Form** — abandoned

### TanStack Query
**Why**: Industry standard for server state. Optimistic updates, request dedup, cache management.
**Rejected alternatives**:
- **SWR** — works but less feature-rich
- **Redux Toolkit Query** — adds Redux baggage we don't need

### React-PDF
**Why**: Renders PDF in browser AND server, perfect Hebrew RTL support, declarative API.
**Rejected alternatives**:
- **Puppeteer-based** — server-only, heavy, slow
- **jsPDF** — manual layout, no React component model

### Aceternity UI
**Why**: Polished animated components that make the marketing pages stand out. 100+ premade.
**Rejected alternatives**: Build from scratch (too slow), Framer Motion only (no premade)

## Backend

### Node.js 22 + Hono
**Why**: Hono is fastest TypeScript HTTP framework (faster than Express, Fastify). Edge-compatible. Tiny bundle.
**Rejected alternatives**:
- **Express** — slow, type unsafe by default
- **Fastify** — good but Hono is faster and more modern
- **NestJS** — too much enterprise scaffolding for our scale
- **Go/Rust** — would need separate runtime; TS everywhere is simpler

### Vercel AI SDK
**Why**: Unified interface for Claude, GPT, Gemini, Llama. Streaming support. Used by Vercel themselves.
**Rejected alternatives**:
- **LangChain.js** — heavier, more abstractions, harder to debug
- **Direct Anthropic SDK only** — locks us in to one provider

### Better Auth
**Why**: Modern TypeScript-first auth library. Lives in our codebase (portfolio-friendly). Supports email/OAuth/magic links/2FA/passkeys.
**Rejected alternatives**:
- **NextAuth.js (Auth.js)** — older, less ergonomic API
- **Clerk** — paid SaaS, less custom
- **Supabase Auth** — tied to Supabase
- **Roll your own** — security risk, not portfolio-impressive

### Drizzle ORM
**Why**: Type-safe SQL builder with great DX. Lightweight. Edge-compatible.
**Rejected alternatives**:
- **Prisma** — heavy runtime, slower queries, schema migration headaches
- **TypeORM** — older, decorator-heavy
- **Raw pg** — type safety lost

## Data

### PostgreSQL 17 (AWS RDS)
**Why**: Industry standard relational DB. JSON support for flexible fields. Full-text search built-in.
**Rejected alternatives**:
- **MySQL** — fine but less feature-rich
- **MongoDB** — relational data fits SQL better
- **DynamoDB** — wrong tool for relational queries
- **Supabase Postgres** — vendor lock-in (but viable backup plan)

### Redis (AWS ElastiCache)
**Why**: Industry standard caching. Rate limiting, session storage, JD cache, ATS computation cache.
**Rejected alternatives**:
- **Memcached** — less feature-rich
- **In-process cache** — doesn't scale across instances

### AWS S3
**Why**: Standard object storage. Cheap, durable, integrated with everything.
**Rejected alternatives**: Cloudflare R2 (cheaper but ties us closer to CF), self-hosted (no thanks)

## AI / LLM

### Claude Sonnet 4.6+ (default)
**Why**: Best at structured output, excellent Hebrew, good cost/quality balance, we have Pro account.
**Rejected as default**:
- **GPT-5** — premium tier option (more expensive)
- **Gemini 2.5** — premium tier option (cheaper but lower quality for our use)
- **Llama 3.3 self-hosted** — could be free tier later, requires GPU infra

### Custom prompt injection defense
**Why**: Resume generators are HIGH attack surface — users paste arbitrary text. We build our own + use `ruflo-aidefence` patterns.
**Rejected alternatives**: Vendor solutions (early, expensive)

## Infrastructure

### AWS (il-central-1 primary, us-east-1 secondary)
**Why**: User chose AWS for portfolio recognition. Tel Aviv region = low latency for Israeli users.
**Rejected alternatives**:
- **GCP** — cheaper compute but less recognized
- **Azure** — too enterprise-focused
- **Cloudflare Workers + R2** — too vendor-specific

### OpenTofu (not Terraform)
**Why**: Open-source fork of Terraform after HashiCorp changed license. Drop-in replacement. Industry trend in 2026 is moving to OpenTofu.
**Rejected alternatives**:
- **Terraform** — license issues post-2023
- **Pulumi** — interesting but smaller community
- **AWS CDK** — vendor-specific
- **CloudFormation** — verbose, AWS-only

### Kubernetes (EKS) + Helm
**Why**: Industry standard for portfolio. Helm for repeatable deploys. ArgoCD for GitOps.
**Rejected alternatives**:
- **ECS Fargate** — simpler but less portable
- **Just Lambda** — works but boring portfolio piece
- **Nomad** — niche

### Docker
**Why**: Industry standard.

### Ansible (for non-IaC config)
**Why**: SSH-based config management for things OpenTofu can't do (e.g., bastion host setup).

### ArgoCD
**Why**: Best GitOps tool. Declarative deploys from git. Web UI for visibility.

## DevOps

### GitHub + GitHub Actions
**Why**: Free for public repos, integrates with our `github` plugin, ubiquitous.
**Rejected alternatives**:
- **GitLab CI** — fine but smaller ecosystem
- **CircleCI** — paid for what GH gives free

### gitleaks + trivy + pre-commit
**Why**: Layered security scanning. Gitleaks catches secrets, trivy catches vulnerable deps/containers/IaC.

## Observability

### Sentry
**Why**: Best error tracking, generous free tier, we have the plugin.

### OpenTelemetry → Grafana + Prometheus + Loki
**Why**: Open source, self-hostable on EKS, industry standard. Portfolio gold.
**Rejected alternatives**:
- **Datadog** — expensive, would blow budget
- **New Relic** — same
- **AWS CloudWatch only** — limited query capability

## Payments

### Stripe
**Why**: Works in Israel, best DX, ubiquitous. Infrastructure ready, not enabled at launch.
**Rejected for v1**:
- **Tranzila + Greeninvoice** — required for Israeli tax compliance but not needed pre-revenue

## Decision Records

We'll add ADRs (Architecture Decision Records) under `docs/adr/` as significant decisions get made. Format:
- Number, title, status, context, decision, consequences
- See [Michael Nygard's ADR template](https://github.com/joelparkerhenderson/architecture-decision-record)

## Version Pins (as of project start)

| Tool | Version |
|---|---|
| Node.js | 22.x |
| pnpm | 9.x |
| TypeScript | 5.7+ |
| Next.js | 16.x |
| Tailwind | 4.x |
| React | 19.x |
| OpenTofu | 1.12+ |
| Docker | 27+ |
| kubectl | 1.34+ |
| Helm | 4.x |
