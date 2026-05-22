# Infrastructure (OpenTofu)

> Infrastructure-as-code for AWS. Defines VPC, EKS, RDS, S3, IAM, and supporting services.

## Layout

```
infra/tofu/
├── modules/              # Reusable modules
│   ├── network/          # VPC + subnets + NAT
│   ├── eks/              # Kubernetes cluster
│   ├── rds/              # Postgres database
│   ├── redis/            # ElastiCache
│   ├── s3/               # Encrypted buckets
│   ├── secrets/          # Secrets Manager
│   ├── route53/          # DNS records
│   └── iam/              # Service roles
├── environments/
│   ├── dev/              # us-east-1, minimal sizing
│   ├── staging/          # us-east-1, scaled-down prod
│   └── prod/             # il-central-1, full HA
└── shared/               # Cross-environment (DNS zone)
```

## Bootstrap

Before any environment can be applied, you need:

### 1. State backend (one-time setup)

The S3 state bucket + DynamoDB lock table must exist before `tofu init` works.

```bash
# Create them manually (or use the bootstrap script)
aws s3api create-bucket \
  --bucket resumaker-tofu-state \
  --region us-east-1 \
  --profile resumaker

aws s3api put-bucket-encryption \
  --bucket resumaker-tofu-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }' \
  --profile resumaker

aws s3api put-bucket-versioning \
  --bucket resumaker-tofu-state \
  --versioning-configuration Status=Enabled \
  --profile resumaker

aws dynamodb create-table \
  --table-name resumaker-tofu-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1 \
  --profile resumaker
```

Or run: `./scripts/bootstrap-tofu-state.sh`

### 2. Initialize an environment

```bash
cd environments/dev
tofu init
```

## Common Operations

### Plan

```bash
cd environments/dev
tofu plan -out=plan.tfplan
```

### Apply

```bash
cd environments/dev
tofu apply plan.tfplan
```

### Destroy (CAREFUL)

```bash
cd environments/dev
tofu destroy
```

### Format

```bash
# Repo root
pnpm infra:fmt
```

### Validate

```bash
# Repo root
pnpm infra:validate
```

## Security

- All state files encrypted at rest (KMS)
- DynamoDB lock prevents concurrent modifications
- `.tfvars` files are gitignored except `*.tfvars.example`
- No secrets in code — pulled from AWS Secrets Manager at runtime
- `default_tags` apply to every resource for cost tracking + compliance

## Cost Discipline

- **Dev environment**: single NAT gateway, smallest instance sizes, deleted nightly via scheduled Lambda (TODO)
- **Staging**: scaled-down prod
- **Prod**: full HA, multi-AZ where it matters

Budget alarms in AWS Budgets will alert if costs creep up.

## CI Integration

`infra/.tflint.hcl` config used by `tflint` in CI. Every PR runs:

- `tofu fmt -check`
- `tofu validate`
- `tflint`
- `trivy config` (security)
- `tofu plan` against the affected env (dry run, comment on PR)

Apply is **manual** — require human approval, never auto-deploy to prod.

## Related

- [../../docs/INFRASTRUCTURE.md](../../docs/INFRASTRUCTURE.md) — High-level infra design
- [../../docs/DEVOPS.md](../../docs/DEVOPS.md) — Deployment pipeline
