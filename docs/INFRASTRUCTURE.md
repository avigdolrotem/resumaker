# Infrastructure

## Cloud: AWS

### Account

- Account ID: `857812839967`
- Name: Rotem Avigdol
- Primary region: `il-central-1` (Tel Aviv)
- Secondary region: `us-east-1` (for global services + cost optimization)

### Cost Controls (Mandatory)

- Budget: $50/month (alerts at 50/80/100/120%)
- Cost Anomaly Detection: $5 daily threshold (pending account age)
- Service Quotas: tightened for expensive services
- Localstack used for local development to avoid AWS bills

## Environments

| Environment | Purpose                           | Region         | Cost Tier                   |
| ----------- | --------------------------------- | -------------- | --------------------------- |
| **local**   | Dev laptop                        | n/a            | $0 (Docker Compose)         |
| **dev**     | Continuous integration validation | `us-east-1`    | minimal (mostly serverless) |
| **staging** | Pre-prod testing                  | `us-east-1`    | scaled-down prod            |
| **prod**    | Live users                        | `il-central-1` | full HA                     |

`us-east-1` is cheaper for non-user-facing workloads. `il-central-1` is for user latency.

## Core Services Per Environment

### Networking

- **VPC** — `10.0.0.0/16`
- **Public subnets** — 2x for ALB
- **Private subnets** — 2x for EKS, RDS, ElastiCache
- **NAT Gateway** — 1 (cost: ~$33/mo, single AZ to save money in dev)
- **Internet Gateway** — 1
- **Route 53** — `resumaker.co.il` zone

### Compute

- **EKS cluster** — Kubernetes 1.32
  - Node group: 2× t3.medium spot instances (cost-saving)
  - HPA based on CPU + custom metrics
- **Lambda** — for low-traffic backend services (cheap with always-free tier)
- **Vercel** — Next.js hosting (external to AWS, free tier)

### Storage

- **RDS PostgreSQL 17** — db.t3.micro (dev), db.t3.small (prod), Multi-AZ in prod
- **ElastiCache Redis** — cache.t3.micro
- **S3 buckets**:
  - `resumaker-prod-files` — user resume files
  - `resumaker-prod-static` — public assets
  - `resumaker-prod-backups` — RDS dumps
  - `resumaker-prod-state` — OpenTofu state
  - `resumaker-prod-logs` — long-term log archive

### Security

- **KMS** — customer-managed keys for RDS, S3, Secrets Manager
- **Secrets Manager** — application secrets
- **IAM** — fine-grained roles per service (no shared)
- **GuardDuty** — threat detection (free tier)
- **CloudTrail** — audit log (1 trail = free)
- **AWS Config** — compliance monitoring (disabled at launch, expensive)
- **Cloudflare** in front of everything for WAF + DDoS

### Observability

- **CloudWatch Logs** — short-term log storage (7 days)
- **Loki** — long-term log search (self-hosted on EKS)
- **Prometheus + Grafana** — metrics (self-hosted on EKS)
- **Sentry** — error tracking (SaaS, free tier)
- **AWS X-Ray** — distributed tracing (optional, mainly for portfolio demo)

## OpenTofu Structure

```
infra/tofu/
├── modules/                  # Reusable modules
│   ├── network/              # VPC, subnets, gateways
│   ├── eks/                  # EKS cluster + node groups
│   ├── rds/                  # Postgres setup
│   ├── redis/                # ElastiCache
│   ├── s3/                   # Encrypted buckets
│   ├── secrets/              # Secrets Manager structure
│   ├── route53/              # DNS records
│   └── iam/                  # Roles & policies
│
├── environments/
│   ├── dev/
│   │   ├── main.tf           # Compose modules with dev sizing
│   │   ├── terraform.tfvars
│   │   └── backend.tf        # S3 backend config
│   ├── staging/
│   └── prod/
│
└── shared/                   # Cross-env (Route53 zone, etc)
```

## State Management

- **Backend**: S3 + DynamoDB lock table
- **Bucket**: `resumaker-prod-state`
- **DynamoDB table**: `resumaker-tofu-locks`
- **Encryption**: SSE-KMS
- **Versioning**: enabled
- **Object lock**: 7-day governance hold (against accidental deletion)

## Networking Diagram (Production)

```
                  ┌─────────────────┐
                  │   Cloudflare    │
                  │   (DNS + WAF)   │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │     Vercel      │
                  │   (Next.js)     │
                  └────────┬────────┘
                           │
                           ▼ (AWS PrivateLink to API)
                  ┌─────────────────┐
                  │  ALB (private)  │
                  └────────┬────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   ┌─────────┐        ┌─────────┐        ┌─────────┐
   │ Service │        │ Service │        │ Service │
   │ Pod 1   │        │ Pod 2   │        │ Pod 3   │
   └────┬────┘        └────┬────┘        └────┬────┘
        └──────────────────┼──────────────────┘
                           ▼
                  ┌─────────────────┐
                  │  RDS Postgres   │
                  │  (Multi-AZ)     │
                  └─────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  ElastiCache    │
                  │  Redis          │
                  └─────────────────┘
```

## Deployment Flow

```
git push main
   │
   ▼
GitHub Actions
   ├─ Lint, typecheck, test
   ├─ Build container images
   ├─ Scan images (trivy)
   ├─ Sign images (cosign)
   └─ Push to ECR + update Helm chart
            │
            ▼
ArgoCD watches Helm repo
   │
   ▼
Apply to EKS
   │
   ▼
Smoke tests run
   │
   ▼
Sentry release marker + Grafana annotation
```

## Disaster Recovery

| Scenario        | RTO  | RPO  | Approach                                |
| --------------- | ---- | ---- | --------------------------------------- |
| Pod crash       | <1m  | 0    | Kubernetes auto-restart                 |
| Node failure    | <5m  | 0    | Multi-AZ EKS, pods reschedule           |
| AZ outage       | <15m | <5m  | Multi-AZ RDS, EKS spans AZs             |
| Region outage   | <4h  | <1h  | Manual restore from cross-region backup |
| Data corruption | <1h  | <24h | Point-in-time restore from RDS          |

### Backup Strategy

- **RDS**: Automated daily snapshots, 7-day retention. Cross-region copy of daily snapshot.
- **S3**: Versioning + 30-day non-current version retention
- **OpenTofu state**: Versioned bucket, lock table prevents corruption
- **Application secrets**: Stored in Vaultwarden (personal) + Secrets Manager (prod)

## Cost Targets

### Monthly Budget Allocation

| Category                   | Target      | Cap         |
| -------------------------- | ----------- | ----------- |
| RDS (small instance)       | $20         | $30         |
| EKS control plane + nodes  | $20         | $40         |
| ALB + NAT Gateway          | $35         | $50         |
| S3 + CloudFront            | $5          | $15         |
| Other (KMS, Secrets, etc.) | $5          | $10         |
| **AWS Total**              | **$85**     | **$145**    |
| Anthropic API              | $50         | $100        |
| Vercel                     | $0          | $20         |
| Cloudflare                 | $0          | $20         |
| Domain renewal             | $1.6/mo     | $2          |
| **Project Total**          | **$137/mo** | **$287/mo** |

Well within $200-300 budget.

## Related Documents

- [DEVOPS.md](DEVOPS.md) — CI/CD pipelines
- [SECURITY.md](SECURITY.md) — Security controls
- [ARCHITECTURE.md](ARCHITECTURE.md) — Overall system design
