# DevOps

## Pipeline Overview

```
Developer commits to feature branch
    │
    ▼
pre-commit hooks (local)
    ├─ gitleaks (no secrets)
    ├─ prettier (formatting)
    ├─ markdownlint
    ├─ terraform_fmt + validate
    └─ yamllint
    │
    ▼
Push to GitHub
    │
    ▼
GitHub Actions: PR pipeline
    ├─ Install pnpm + dependencies (cached)
    ├─ Lint (eslint)
    ├─ Typecheck (tsc --noEmit)
    ├─ Test (vitest)
    ├─ Build (next build, tsc)
    ├─ Security scans
    │   ├─ gitleaks (history)
    │   ├─ trivy (deps + IaC + container)
    │   ├─ semgrep (SAST)
    │   └─ pnpm audit
    ├─ tflint (OpenTofu lint)
    └─ Container build + push to ECR (PR preview)
    │
    ▼
Vercel: preview deploy of frontend
    │
    ▼
Reviewer approves PR
    │
    ▼
Merge to main
    │
    ▼
GitHub Actions: deploy pipeline
    ├─ Build containers (multi-arch)
    ├─ Sign images (cosign)
    ├─ Generate SBOM (syft)
    ├─ Push to ECR
    └─ Update Helm chart version in `infra/helm`
    │
    ▼
ArgoCD detects change
    │
    ▼
ArgoCD applies to EKS (staging first, then prod after approval)
    │
    ▼
Smoke tests run
    │
    ▼
Sentry release marker + Grafana annotation
```

## CI/CD Tools

| Tool               | Purpose                               |
| ------------------ | ------------------------------------- |
| **GitHub Actions** | CI pipeline runner                    |
| **Vercel**         | Frontend preview + production deploys |
| **ArgoCD**         | GitOps continuous deployment to EKS   |
| **ECR**            | Container image registry              |
| **Cosign**         | Container image signing               |
| **Syft**           | SBOM generation                       |
| **Trivy**          | Container/IaC/dep vuln scanning       |
| **Gitleaks**       | Secret detection                      |
| **Semgrep**        | SAST                                  |
| **OpenTofu**       | Infrastructure provisioning           |
| **Helm**           | Kubernetes templating                 |

## Workflows (.github/workflows/)

### `ci.yml` — On every push & PR

- Lint, typecheck, test
- Build
- Container build (if Dockerfile changed)
- ~5-10 min total

### `security.yml` — On every PR + push to main

(The nightly scheduled run was removed 2026-10-13 while the project is dormant.)

- Gitleaks full history scan
- Trivy deep scan
- pnpm audit
- Semgrep with custom rules
- ~3-5 min

### `infra.yml` — On infra/\* changes

- tflint
- tofu fmt check
- tofu validate
- tofu plan (dry run, comment on PR)
- Manual approval before apply

### `deploy-staging.yml` — On merge to main

- Build & push container images
- Update staging Helm values
- ArgoCD picks up automatically
- Smoke test
- Notify Slack on failure

### `deploy-prod.yml` — On version tag (vX.Y.Z)

- Same as staging but to prod EKS
- Requires manual approval
- Blue-green deploy via ArgoCD rollout

## Branching Strategy

Trunk-based development with short-lived feature branches.

```
main (always deployable)
  └─ feature/<short-name>  (lifetime: hours to days, never weeks)
  └─ fix/<short-name>
  └─ chore/<short-name>
```

Tags: `vMAJOR.MINOR.PATCH` for releases.

## Environments

There is no local-dev environment and no staging tier by design —
single-environment deployment model. CI runs tests + typecheck on every
push; merged commits to `main` are eligible for tagging.

### Production

- Tag-deployed (`v1.2.3`)
- Database: production RDS Multi-AZ
- Cloudflare in front
- URL: `resumaker.co.il`
- Monitoring: full Grafana + Sentry + PagerDuty

## Container Strategy

### Image Optimization

- Multi-stage Dockerfiles
- Distroless base images for Node.js services
- Tiny `<200MB` for backend services, `<500MB` for frontend
- Multi-arch (amd64 + arm64)

### Naming

- Registry: `<account>.dkr.ecr.il-central-1.amazonaws.com`
- Repository per service: `resumaker/auth`, `resumaker/resume-generator`, etc.
- Tags: `<git-sha>` always, plus `latest` for main, plus semver for releases

### Lifecycle

- Untagged images: deleted after 7 days
- Tagged but not deployed: deleted after 30 days
- Production images: retained 90 days

## Kubernetes

### Cluster Layout

```
EKS Cluster: resumaker-prod
├── Namespace: resumaker (the app)
│   ├── Deployment: auth-service
│   ├── Deployment: jd-parser
│   ├── Deployment: resume-generator
│   ├── Deployment: ats-scorer
│   ├── Deployment: billing
│   ├── Service: each of above (ClusterIP)
│   ├── Ingress: ALB
│   └── HPA: each deployment
├── Namespace: monitoring
│   ├── Prometheus
│   ├── Grafana
│   ├── Loki
│   └── Alertmanager
├── Namespace: argocd
│   └── ArgoCD installation
└── Namespace: ingress-nginx (or AWS Load Balancer Controller)
```

### Resource Limits

Every pod has CPU + memory requests/limits. No `latest` tags in production.

### Liveness/Readiness Probes

Every service implements `/health` (liveness) and `/ready` (readiness).

### Graceful Shutdown

SIGTERM → drain in-flight requests (30s grace) → exit cleanly.

## Helm Charts

```
infra/helm/
├── resumaker/              # Umbrella chart
│   ├── Chart.yaml
│   ├── values.yaml          # Base
│   ├── values.dev.yaml
│   ├── values.staging.yaml
│   └── values.prod.yaml
└── charts/                  # Subcharts per service
    ├── auth/
    ├── jd-parser/
    ├── resume-generator/
    ├── ats-scorer/
    └── billing/
```

## ArgoCD Configuration

### App-of-Apps Pattern

```
ArgoCD App: resumaker-root
  ├─ Manages: ArgoCD App: monitoring (Prometheus/Grafana stack)
  ├─ Manages: ArgoCD App: ingress
  ├─ Manages: ArgoCD App: resumaker-staging
  └─ Manages: ArgoCD App: resumaker-prod
```

Each environment has its own Application, syncing from a path in `infra/helm/` with environment-specific values.

### Sync Policies

- **Staging**: auto-sync, auto-prune, self-heal
- **Production**: manual sync (require explicit approval), auto-prune disabled

## Database Migrations

### Tool: Drizzle Kit

```
apps/api/auth/drizzle/
  ├── 0001_initial.sql
  ├── 0002_add_passkeys.sql
  └── meta/
```

### Process

1. Developer adds new migration via `drizzle-kit generate`
2. PR review includes migration SQL
3. CI runs migration against ephemeral test DB
4. On merge to staging: migration runs via init container before app starts
5. Production: explicit approval step before migration runs

### Backwards Compatibility

- Every migration must be backwards compatible with N-1 app version
- For breaking changes: two-step (add new column, deploy, drop old column in next release)

## Secrets in CI

| Secret                     | Purpose                            | Stored In              |
| -------------------------- | ---------------------------------- | ---------------------- |
| AWS_ACCESS_KEY_ID + SECRET | OpenTofu + ECR push                | GitHub Actions Secrets |
| ANTHROPIC_API_KEY          | Tests against real LLM (sparingly) | GitHub Actions Secrets |
| VERCEL_TOKEN               | Frontend deploys                   | GitHub Actions Secrets |
| ARGOCD_AUTH_TOKEN          | Trigger sync                       | GitHub Actions Secrets |
| CODECOV_TOKEN              | Coverage reporting                 | GitHub Actions Secrets |

All rotated per security policy. Never echo'd in logs (masking enabled).

## Observability in CI/CD

- Sentry release marker on every prod deploy
- Grafana annotation on every prod deploy
- Slack notification (channel `#deploys`) for success/failure
- DORA metrics tracked: deployment frequency, lead time, MTTR, change failure rate

## Runbooks

`docs/runbooks/` contains step-by-step responses for common incidents:

- `deploy-rollback.md`
- `database-restore.md`
- `cost-spike-investigation.md`
- `auth-compromise.md`
- `llm-injection-detected.md`

## Performance Budgets

| Metric                   | Budget         |
| ------------------------ | -------------- |
| Lighthouse Performance   | >85            |
| Lighthouse Accessibility | >95            |
| LCP                      | <2.5s          |
| FID                      | <100ms         |
| CLS                      | <0.1           |
| Bundle size (initial)    | <250KB gzipped |
| LLM call P95             | <8s            |
| API call P95 (non-LLM)   | <300ms         |

Enforced via Lighthouse CI in PR pipeline.

## Related

- [INFRASTRUCTURE.md](INFRASTRUCTURE.md) — AWS resource detail
- [MICROSERVICES.md](MICROSERVICES.md) — Service architecture
- [SECURITY.md](SECURITY.md) — Security controls in pipeline
