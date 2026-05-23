# Deployment

> First-launch + ongoing operations guide for resumaker.co.il.

## Prerequisites

- [ ] AWS account verified, MFA on root, IAM user `claude-code-resumaker` created
- [ ] OpenTofu state backend created (`./scripts/bootstrap-tofu-state.sh`)
- [ ] Cloudflare account, `resumaker.co.il` zone added
- [ ] GitHub repo created, secrets configured (see below)
- [ ] Resend account + verified sending domain
- [ ] Production Anthropic API key (separate from dev)
- [ ] Production secrets in `/Volumes/Server_Data/secrets/` (or AWS Secrets Manager)

## First Production Deploy

### 1. Provision infrastructure

```bash
cd infra/tofu/environments/prod
tofu init
tofu plan -out=plan.tfplan
# Review carefully — this will create real resources
tofu apply plan.tfplan
```

What gets created:

- VPC with 2 public + 2 private subnets across AZs
- EKS cluster (Kubernetes 1.32)
- RDS Postgres 17 (Multi-AZ, encrypted at rest with KMS)
- ElastiCache Redis (single-AZ to start)
- S3 buckets (files, static, backups, logs)
- ALB (in front of EKS)
- Route 53 records pointed at ALB
- IAM roles for service accounts (IRSA)
- CloudWatch alarms tied to AWS Budgets

Expected first-month cost: ~$80-150 depending on traffic.

### 2. Configure GitHub Actions secrets

In repo settings → Secrets → Actions:

| Secret                  | Where to get it                           |
| ----------------------- | ----------------------------------------- |
| `AWS_ACCESS_KEY_ID`     | IAM user → Security credentials           |
| `AWS_SECRET_ACCESS_KEY` | (only shown once at key creation)         |
| `ANTHROPIC_API_KEY`     | console.anthropic.com (PROD key, not dev) |
| `RESEND_API_KEY`        | resend.com                                |
| `SENTRY_DSN`            | sentry.io (after creating project)        |
| `BETTER_AUTH_SECRET`    | `openssl rand -base64 32`                 |
| `DATABASE_URL`          | RDS endpoint with credentials             |
| `STRIPE_SECRET_KEY`     | dashboard.stripe.com (when ready)         |

### 3. Run database migrations

```bash
# Set DATABASE_URL to the RDS endpoint
export DATABASE_URL='postgres://user:pass@resumaker-prod.xxx.rds.amazonaws.com/resumaker'
pnpm --filter @resumaker/web db:migrate
```

Or use the Helm `pre-install`/`pre-upgrade` Job which runs `drizzle-kit migrate` automatically.

### 4. Deploy app

```bash
git tag v1.0.0
git push --tags
# GitHub Actions builds container, pushes to ECR, updates Helm values
# ArgoCD picks up the change and syncs to EKS
```

Verify:

```bash
kubectl get pods -n resumaker
# Look for: web-xxx Running 1/1
# Liveness: /api/health returning 200
# Readiness: /api/health/ready returning 200 (Postgres + Redis healthy)
```

### 5. Cloudflare configuration

In dash.cloudflare.com:

- DNS → confirm A record for `resumaker.co.il` points to ALB
- SSL/TLS → set to "Full (strict)"
- Security → Bot Fight Mode: on
- Security → WAF → managed rules: on
- Rules → Page Rules:
  - `resumaker.co.il/api/*` → cache: bypass
- Workers → optional: edge rate limiting for `/api/*`

### 6. Smoke tests

```bash
curl -fsS https://resumaker.co.il/api/health
curl -fsS https://resumaker.co.il/api/health/ready
curl -fsS https://resumaker.co.il/he -o /dev/null
# Sign up flow (manual): visit /he/sign-up, verify email arrives
# Generate flow (manual): paste JD, get resume, download PDF
```

## Ongoing Operations

### Deploying a new version

```bash
# Bug fix:
git checkout main
# (commit fix)
git tag v1.0.1
git push --tags
# CI auto-deploys to staging; manually promote to prod via ArgoCD UI

# New feature:
# (Merge to main)
# ArgoCD auto-deploys staging
# Manually promote prod after smoke test
```

### Rollback

ArgoCD UI → resumaker-prod → History → Sync to previous revision.
Or `kubectl rollout undo deployment/web -n resumaker`.

### Adding a new admin

```bash
# Make user an admin
psql $DATABASE_URL -c "UPDATE users SET role='admin' WHERE email='person@example.com';"
```

### Investigating cost spike

1. AWS Budgets email arrives → click the link
2. Cost Explorer → group by service to find culprit
3. If Anthropic: check `generations` table for unusual usage pattern
4. If RDS: check connection count, slow queries
5. See `docs/runbooks/cost-spike.md` for details

### Rotating secrets

Quarterly (or on suspicion of compromise):

```bash
# 1. Rotate Anthropic
# - Create new key at console.anthropic.com
# - Update GH Actions secret + redeploy
# - Delete old key after 24h

# 2. Rotate BETTER_AUTH_SECRET
# - Generate: openssl rand -base64 32
# - Update secret, redeploy
# - WARNING: invalidates all sessions — users must re-login

# 3. Rotate Stripe (if used)
# - Roll in Stripe dashboard, update GH secret, redeploy
```

### Restoring from backup

RDS does automated daily snapshots (7-day retention).

```bash
# Find snapshot
aws rds describe-db-snapshots --db-instance-identifier resumaker-prod
# Restore to new instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier resumaker-restored \
  --db-snapshot-identifier <snapshot-id>
# Test, then point app at new instance via DATABASE_URL
```

### Killing a stuck session

```bash
psql $DATABASE_URL -c "DELETE FROM sessions WHERE user_id='<id>';"
# Or all sessions:
psql $DATABASE_URL -c "DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '1 day';"
```

### Disabling LLM (emergency cost stop)

```bash
# Set env var, redeploy
LLM_ENABLED=false
# Or kill the deployment entirely:
kubectl scale deployment web --replicas=0 -n resumaker
```

## Health Monitoring

| Metric                  | Threshold      | Action                              |
| ----------------------- | -------------- | ----------------------------------- |
| `/api/health/ready` 503 | >5 consecutive | PagerDuty critical                  |
| LLM call P95            | >15s           | Investigate, possibly reduce model  |
| LLM cost/day            | >$50           | Investigate abuse, throttle         |
| Active sessions         | >10k           | Scale Redis                         |
| Postgres connections    | >70%           | Increase pool, add pgBouncer        |
| Disk usage              | >75%           | RDS auto-scaling or manual increase |

Grafana dashboards: `monitoring/grafana/dashboards/`.

## SLOs

| Service           | SLO              | Error budget |
| ----------------- | ---------------- | ------------ |
| Marketing pages   | 99.9% uptime     | 43 min/month |
| Authenticated app | 99.5% uptime     | 3.6 hr/month |
| LLM generation    | 95% success rate | 5% per week  |

## Compliance Reminders

- **Israeli Privacy Law (1981, updated 2024)**:
  - If >10K user records: register with PPA
  - Breach notification within 72h to PPA + affected users
  - Hebrew privacy policy mandatory (we have it at `/he/privacy`)
  - Data export endpoint (`/api/account/export`) — works
  - Account deletion + 30-day purge — TODO: implement purge cron
- **GDPR** (for EU visitors):
  - Cookie banner: not required if only essential cookies
  - DPA with sub-processors (Anthropic, Stripe, Resend) — sign on launch
- **Heshbonit (חשבונית)**: required when accepting payments. Skip until paid tier launches.

## Disaster Recovery

| Scenario        | RTO  | RPO  | Process                                      |
| --------------- | ---- | ---- | -------------------------------------------- |
| Pod crash       | <1m  | 0    | k8s auto-restart                             |
| AZ outage       | <15m | <5m  | Multi-AZ RDS, EKS reschedules                |
| Region outage   | <4h  | <1h  | Manual restore from cross-region S3 snapshot |
| Data corruption | <1h  | <24h | RDS point-in-time restore                    |
| Total wipe      | <24h | <24h | Full restore from backups                    |

See `docs/runbooks/disaster-recovery.md` for step-by-step procedures.
