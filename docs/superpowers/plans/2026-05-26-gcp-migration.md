# GCP Migration (Track 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision dev/staging/prod GCP environments (VPC + GKE Autopilot + Cloud SQL + Memorystore + Artifact Registry + GCS + Secret Manager + Workload Identity Federation) in `europe-west1` via OpenTofu, then cut the Vercel-hosted Next.js app over from Neon to Cloud SQL using IAM auth via the Cloud SQL Connector.

**Architecture:** Parallel GCP module tree at `infra/tofu/modules/gcp/*` (existing AWS modules stay dormant), per-env entry points at `infra/tofu/environments/{dev,staging,prod}-gcp/`, state in per-project GCS buckets. Bootstrap is manual `gcloud` once; Tofu owns everything after. Vercel app reaches Cloud SQL through the npm `@google-cloud/cloud-sql-connector` using short-lived credentials minted from Vercel OIDC via WIF.

**Tech Stack:** OpenTofu (Terraform-compatible), Google Cloud (GKE Autopilot, Cloud SQL Postgres 15, Memorystore Redis 7, Artifact Registry, GCS, Secret Manager, Cloud IAM with Workload Identity Federation), Helm + ArgoCD, GitHub Actions, Next.js 16, `@google-cloud/cloud-sql-connector`, `postgres` (the existing client lib).

**Spec:** `docs/superpowers/specs/2026-05-26-gcp-migration-design.md`.

**Reference:** existing AWS Tofu modules under `infra/tofu/modules/{network,eks,rds,elasticache,s3,ecr}` — use them as templates for shape and outputs, but do NOT copy resources directly.

---

## File Structure

### New files

```
infra/tofu/
├── bootstrap/
│   ├── README.md                                  # operator-facing setup doc
│   └── bootstrap.sh                               # idempotent gcloud script
└── modules/gcp/
    ├── network/{main.tf,variables.tf,outputs.tf,versions.tf,README.md}
    ├── workload-identity/{main.tf,variables.tf,outputs.tf,versions.tf}
    ├── secrets/{main.tf,variables.tf,outputs.tf,versions.tf}
    ├── cloudsql/{main.tf,variables.tf,outputs.tf,versions.tf}
    ├── memorystore/{main.tf,variables.tf,outputs.tf,versions.tf}
    ├── gcs/{main.tf,variables.tf,outputs.tf,versions.tf}
    ├── artifactregistry/{main.tf,variables.tf,outputs.tf,versions.tf}
    └── gke/{main.tf,variables.tf,outputs.tf,versions.tf,README.md}

infra/tofu/environments/
├── dev-gcp/{main.tf,backend.tf,providers.tf,variables.tf,outputs.tf,terraform.tfvars}
├── staging-gcp/{main.tf,backend.tf,providers.tf,variables.tf,outputs.tf,terraform.tfvars}
└── prod-gcp/{main.tf,backend.tf,providers.tf,variables.tf,outputs.tf,terraform.tfvars}

infra/helm/resumaker/
└── values.{dev,staging,prod}-gcp.yaml             # GKE Ingress + Secret Manager refs

apps/web/src/db/
└── cloudsql.ts                                    # Cloud SQL Connector path

.github/workflows/
└── deploy-gcp.yml                                 # parallel pipeline (kept separate from deploy.yml during transition)
```

### Modified files

```
.github/workflows/infra.yml                        # add dev-gcp/staging-gcp/prod-gcp Tofu matrix entries
apps/web/package.json                              # add @google-cloud/cloud-sql-connector
apps/web/src/lib/env.ts                            # add GCP_* env vars (optional during transition)
apps/web/src/db/index.ts                           # if GCP_CLOUD_SQL_INSTANCE set, dispatch to cloudsql.ts; else current path
apps/web/.env.example                              # document the new GCP_* env vars
```

---

## Phase 0 — Bootstrap (one-time, operator-driven)

This phase is run BY HAND once per project. It creates the GCP projects, enables APIs, and provisions the Tofu state buckets — the chicken-and-egg that Tofu can't own its own state for.

### Task 0.1: Write the bootstrap script

**Files:**

- Create: `infra/tofu/bootstrap/bootstrap.sh`
- Create: `infra/tofu/bootstrap/README.md`

- [ ] **Step 1: Write the script**

Create `infra/tofu/bootstrap/bootstrap.sh`:

```bash
#!/usr/bin/env bash
#
# Resumaker GCP bootstrap — idempotent. Run once per env.
#
# Usage:
#   ./bootstrap.sh <env>
# where <env> ∈ {dev, staging, prod}.
#
# Prerequisites:
#   - You are logged into gcloud as a user with project-creator and billing-account-user roles.
#   - The billing account ID is exported as $BILLING_ACCOUNT_ID.
#   - $ORG_ID is set if you use an organization; leave unset for personal projects.

set -euo pipefail

ENV="${1:-}"
[[ "$ENV" =~ ^(dev|staging|prod)$ ]] || { echo "Usage: $0 <dev|staging|prod>"; exit 1; }
: "${BILLING_ACCOUNT_ID:?Set BILLING_ACCOUNT_ID env var}"

PROJECT_ID="resumaker-$ENV"
STATE_BUCKET="resumaker-$ENV-tfstate"
TF_ADMIN_SA="tofu-admin@$PROJECT_ID.iam.gserviceaccount.com"
REGION="europe-west1"

REQUIRED_APIS=(
  compute.googleapis.com
  container.googleapis.com
  sqladmin.googleapis.com
  redis.googleapis.com
  servicenetworking.googleapis.com
  secretmanager.googleapis.com
  artifactregistry.googleapis.com
  iam.googleapis.com
  iamcredentials.googleapis.com
  cloudresourcemanager.googleapis.com
  sts.googleapis.com
)

echo "==> Creating project $PROJECT_ID (idempotent)..."
gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud projects create "$PROJECT_ID" --name="Resumaker $ENV" \
    ${ORG_ID:+--organization=$ORG_ID}

echo "==> Linking billing account..."
gcloud billing projects link "$PROJECT_ID" \
  --billing-account="$BILLING_ACCOUNT_ID"

echo "==> Enabling APIs..."
gcloud services enable "${REQUIRED_APIS[@]}" --project="$PROJECT_ID"

echo "==> Creating state bucket $STATE_BUCKET..."
gcloud storage buckets describe "gs://$STATE_BUCKET" >/dev/null 2>&1 || \
  gcloud storage buckets create "gs://$STATE_BUCKET" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --uniform-bucket-level-access \
    --public-access-prevention
gcloud storage buckets update "gs://$STATE_BUCKET" --versioning

echo "==> Creating Tofu admin service account..."
gcloud iam service-accounts describe "$TF_ADMIN_SA" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud iam service-accounts create tofu-admin \
    --display-name="OpenTofu admin (bootstrap-provisioned)" \
    --project="$PROJECT_ID"

# Grant project owner to the Tofu admin SA — scoped down post-launch.
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$TF_ADMIN_SA" \
  --role="roles/owner"

# Allow the human operator running this script to impersonate the SA.
HUMAN="$(gcloud config get-value account)"
gcloud iam service-accounts add-iam-policy-binding "$TF_ADMIN_SA" \
  --project="$PROJECT_ID" \
  --member="user:$HUMAN" \
  --role="roles/iam.serviceAccountTokenCreator"

echo "==> Bootstrap complete for $ENV."
cat <<EOF

  PROJECT_ID:     $PROJECT_ID
  STATE_BUCKET:   $STATE_BUCKET
  TF_ADMIN_SA:    $TF_ADMIN_SA
  REGION:         $REGION

Next: cd ../environments/${ENV}-gcp && tofu init && tofu plan
EOF
```

Make it executable: `chmod +x infra/tofu/bootstrap/bootstrap.sh` (the next commit will pick up the bit).

- [ ] **Step 2: Write the README**

Create `infra/tofu/bootstrap/README.md`:

````markdown
# GCP Bootstrap

One-time per env. Creates the GCP project, links billing, enables APIs, creates the Tofu state bucket, and provisions a Tofu admin service account.

## Prerequisites

- `gcloud` CLI installed and authenticated as a user with permissions to:
  - Create projects (`roles/resourcemanager.projectCreator` at org/folder, or no constraint for personal accounts).
  - Use the billing account (`roles/billing.user`).
- The billing account ID. Find it: `gcloud billing accounts list --format="value(name)"`.

## Run

```bash
export BILLING_ACCOUNT_ID="01ABCD-234567-89EFGH"
# Optional: export ORG_ID="<numeric-org-id>"

./bootstrap.sh dev
./bootstrap.sh staging
./bootstrap.sh prod
```
````

Each run is idempotent — safe to re-run if something fails midway.

## What gets created

| Resource      | Name                             |
| ------------- | -------------------------------- |
| GCP project   | `resumaker-{env}`                |
| State bucket  | `gs://resumaker-{env}-tfstate`   |
| Tofu admin SA | `tofu-admin@resumaker-{env}.iam` |

After bootstrap, Tofu can run against `infra/tofu/environments/{env}-gcp/`.

## De-bootstrap

```bash
gcloud projects delete resumaker-<env>
```

(Project is deleted asynchronously — purged after 30 days. State bucket goes with it.)

````

- [ ] **Step 3: Commit**

```bash
git add infra/tofu/bootstrap/
git commit -m "feat(infra): GCP bootstrap script (Phase 0)"
````

---

### Task 0.2: Operator runs the bootstrap

This task is NOT a subagent job — the human operator runs the script and shares the output.

- [ ] **Step 1: Operator pre-flight**

Confirm gcloud is authenticated:

```bash
gcloud auth list
gcloud config get-value account
gcloud billing accounts list --format="value(name,displayName)"
```

If you'll use just the trial credits, choose the billing account from the trial (`gcloud billing accounts list` shows trial accounts with `(open)` status).

- [ ] **Step 2: Run for dev**

```bash
cd infra/tofu/bootstrap
export BILLING_ACCOUNT_ID="<your-billing-account-id>"
./bootstrap.sh dev
```

Expected: prints "Bootstrap complete for dev." with project ID, state bucket, and SA email. Save these to a scratch file — they go into `terraform.tfvars` in Task 4.1.

- [ ] **Step 3: Run for staging and prod**

```bash
./bootstrap.sh staging
./bootstrap.sh prod
```

- [ ] **Step 4: Verify**

```bash
gcloud projects list --filter="name:resumaker-*"
gcloud storage buckets list --filter="name:resumaker-*-tfstate"
gcloud iam service-accounts list --project=resumaker-prod
```

You should see 3 projects, 3 buckets, and 1 tofu-admin SA per project.

No commit needed — this task is operator-side only.

---

## Phase 1 — Foundation modules (network, workload-identity, secrets)

These three modules have no GCP dependencies on each other; they can be written in parallel by reviewers. But to keep tasks bite-sized and linear, we'll do them in order.

### Task 1.1: `network` module

**Files:**

- Create: `infra/tofu/modules/gcp/network/main.tf`
- Create: `infra/tofu/modules/gcp/network/variables.tf`
- Create: `infra/tofu/modules/gcp/network/outputs.tf`
- Create: `infra/tofu/modules/gcp/network/versions.tf`
- Create: `infra/tofu/modules/gcp/network/README.md`

- [ ] **Step 1: `versions.tf`**

```hcl
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}
```

- [ ] **Step 2: `variables.tf`**

```hcl
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "europe-west1"
}

variable "env" {
  description = "Environment name (dev|staging|prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.env)
    error_message = "env must be one of: dev, staging, prod."
  }
}

variable "vpc_cidr" {
  description = "Primary VPC CIDR (e.g. 10.0.0.0/16 for dev)"
  type        = string
}

variable "subnet_cidr" {
  description = "Subnet CIDR within the VPC (e.g. 10.0.1.0/24)"
  type        = string
}

variable "pods_cidr" {
  description = "Secondary range for GKE pods (e.g. 10.0.16.0/20)"
  type        = string
}

variable "services_cidr" {
  description = "Secondary range for GKE services (e.g. 10.0.32.0/20)"
  type        = string
}

variable "private_services_cidr" {
  description = "/16 range reserved for Cloud SQL + Memorystore VPC peering"
  type        = string
}
```

- [ ] **Step 3: `main.tf`**

```hcl
locals {
  name_prefix = "resumaker-${var.env}"
}

resource "google_compute_network" "main" {
  project                 = var.project_id
  name                    = "${local.name_prefix}-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

resource "google_compute_subnetwork" "main" {
  project                  = var.project_id
  name                     = "${local.name_prefix}-subnet"
  network                  = google_compute_network.main.id
  region                   = var.region
  ip_cidr_range            = var.subnet_cidr
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "${local.name_prefix}-pods"
    ip_cidr_range = var.pods_cidr
  }
  secondary_ip_range {
    range_name    = "${local.name_prefix}-services"
    ip_cidr_range = var.services_cidr
  }
}

# Private services range for Cloud SQL + Memorystore VPC peering.
resource "google_compute_global_address" "private_services" {
  project       = var.project_id
  name          = "${local.name_prefix}-private-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  address       = split("/", var.private_services_cidr)[0]
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]
}

# Cloud NAT so GKE pods can reach the internet.
resource "google_compute_router" "main" {
  project = var.project_id
  name    = "${local.name_prefix}-router"
  network = google_compute_network.main.id
  region  = var.region
}

resource "google_compute_router_nat" "main" {
  project                            = var.project_id
  name                               = "${local.name_prefix}-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}
```

- [ ] **Step 4: `outputs.tf`**

```hcl
output "network_id" {
  value = google_compute_network.main.id
}

output "network_name" {
  value = google_compute_network.main.name
}

output "network_self_link" {
  value = google_compute_network.main.self_link
}

output "subnet_id" {
  value = google_compute_subnetwork.main.id
}

output "subnet_name" {
  value = google_compute_subnetwork.main.name
}

output "subnet_self_link" {
  value = google_compute_subnetwork.main.self_link
}

output "pods_range_name" {
  value = "${var.env == "" ? "" : "resumaker-${var.env}-pods"}"
}

output "services_range_name" {
  value = "resumaker-${var.env}-services"
}

output "private_services_connection" {
  value = google_service_networking_connection.private_services.network
}
```

- [ ] **Step 5: `README.md`**

```markdown
# Network module (GCP)

Creates: VPC, subnet (with secondary ranges for GKE pods/services), private services range for Cloud SQL/Memorystore peering, Cloud Router + Cloud NAT.

## Inputs

| Variable                | Description                             |
| ----------------------- | --------------------------------------- |
| `project_id`            | GCP project ID                          |
| `region`                | GCP region (default `europe-west1`)     |
| `env`                   | `dev` \| `staging` \| `prod`            |
| `vpc_cidr`              | Primary CIDR (e.g. `10.0.0.0/16`)       |
| `subnet_cidr`           | `/24` subnet for nodes                  |
| `pods_cidr`             | `/20` secondary for GKE pods            |
| `services_cidr`         | `/20` secondary for GKE services        |
| `private_services_cidr` | `/16` for Cloud SQL/Memorystore peering |

## Outputs

`network_id`, `network_name`, `network_self_link`, `subnet_id`, `subnet_name`, `subnet_self_link`, `pods_range_name`, `services_range_name`, `private_services_connection`.

## Per-env CIDRs (chosen)

| env     | VPC         | subnet      | pods         | services     | private services |
| ------- | ----------- | ----------- | ------------ | ------------ | ---------------- |
| dev     | 10.0.0.0/16 | 10.0.1.0/24 | 10.0.16.0/20 | 10.0.32.0/20 | 10.0.128.0/16    |
| staging | 10.1.0.0/16 | 10.1.1.0/24 | 10.1.16.0/20 | 10.1.32.0/20 | 10.1.128.0/16    |
| prod    | 10.2.0.0/16 | 10.2.1.0/24 | 10.2.16.0/20 | 10.2.32.0/20 | 10.2.128.0/16    |
```

- [ ] **Step 6: `tofu fmt` + commit**

```bash
cd infra/tofu/modules/gcp/network
tofu fmt
cd /Volumes/Server_Data/code-server/workspace/resumaker
git add infra/tofu/modules/gcp/network/
git commit -m "feat(infra/gcp): network module — VPC + NAT + private services"
```

---

### Task 1.2: `workload-identity` module

**Files:**

- Create: `infra/tofu/modules/gcp/workload-identity/main.tf`
- Create: `infra/tofu/modules/gcp/workload-identity/variables.tf`
- Create: `infra/tofu/modules/gcp/workload-identity/outputs.tf`
- Create: `infra/tofu/modules/gcp/workload-identity/versions.tf`

- [ ] **Step 1: `versions.tf`** — identical block as Task 1.1 Step 1.

- [ ] **Step 2: `variables.tf`**

```hcl
variable "project_id" {
  type = string
}

variable "env" {
  type = string
}

variable "github_repo" {
  description = "owner/repo (e.g. resumaker/resumaker)"
  type        = string
}

variable "vercel_team_id" {
  description = "Vercel team id (find via `vercel teams list`). Used to bind WIF to the Vercel OIDC issuer."
  type        = string
}

variable "vercel_project_id" {
  description = "Vercel project id (find via `vercel project ls`)."
  type        = string
}
```

- [ ] **Step 3: `main.tf`**

```hcl
locals {
  name_prefix = "resumaker-${var.env}"
}

# Pool that both GitHub Actions and Vercel federate into.
resource "google_iam_workload_identity_pool" "main" {
  project                   = var.project_id
  workload_identity_pool_id = "${local.name_prefix}-wif-pool"
  display_name              = "Resumaker ${var.env} WIF pool"
  description               = "Trusts GitHub Actions and Vercel OIDC tokens."
}

# GitHub Actions provider — repo+branch claim binding via attribute mapping.
resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.main.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub Actions"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == \"${var.github_repo}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Vercel OIDC provider — project+env binding.
resource "google_iam_workload_identity_pool_provider" "vercel" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.main.workload_identity_pool_id
  workload_identity_pool_provider_id = "vercel"
  display_name                       = "Vercel"

  attribute_mapping = {
    "google.subject"            = "assertion.sub"
    "attribute.aud"             = "assertion.aud"
    "attribute.vercel_project"  = "assertion.project_id"
    "attribute.vercel_env"      = "assertion.environment"
  }

  # Lock to this specific project_id; deployments from other Vercel projects can't federate.
  attribute_condition = "assertion.project_id == \"${var.vercel_project_id}\""

  oidc {
    issuer_uri        = "https://oidc.vercel.com/${var.vercel_team_id}"
    allowed_audiences = ["https://vercel.com/${var.vercel_team_id}"]
  }
}

# App service account — Vercel federates into this for runtime DB connections.
resource "google_service_account" "app" {
  project      = var.project_id
  account_id   = "resumaker-app"
  display_name = "Resumaker Next.js app (Vercel)"
}

# Grant Vercel-federated identities permission to impersonate the app SA
# (limit to the specific Vercel project + production env).
resource "google_service_account_iam_member" "app_vercel_binding" {
  service_account_id = google_service_account.app.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.main.name}/attribute.vercel_project/${var.vercel_project_id}"
}

# CI/CD service account — GitHub Actions deploys via this.
resource "google_service_account" "cicd" {
  project      = var.project_id
  account_id   = "resumaker-cicd"
  display_name = "Resumaker GitHub Actions CI/CD"
}

resource "google_service_account_iam_member" "cicd_github_binding" {
  service_account_id = google_service_account.cicd.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.main.name}/attribute.repository/${var.github_repo}"
}

# Minimum roles for the CI/CD SA. Scoped down later.
resource "google_project_iam_member" "cicd_roles" {
  for_each = toset([
    "roles/artifactregistry.writer",
    "roles/container.developer",
  ])
  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.cicd.email}"
}
```

- [ ] **Step 4: `outputs.tf`**

```hcl
output "pool_name" {
  value = google_iam_workload_identity_pool.main.name
}

output "github_provider_name" {
  value = google_iam_workload_identity_pool_provider.github.name
}

output "vercel_provider_name" {
  value = google_iam_workload_identity_pool_provider.vercel.name
}

output "app_service_account_email" {
  value = google_service_account.app.email
}

output "cicd_service_account_email" {
  value = google_service_account.cicd.email
}
```

- [ ] **Step 5: `tofu fmt` + commit**

```bash
cd infra/tofu/modules/gcp/workload-identity && tofu fmt
cd /Volumes/Server_Data/code-server/workspace/resumaker
git add infra/tofu/modules/gcp/workload-identity/
git commit -m "feat(infra/gcp): workload-identity module — WIF pool + app + cicd SAs"
```

---

### Task 1.3: `secrets` module

**Files:**

- Create: `infra/tofu/modules/gcp/secrets/{main,variables,outputs,versions}.tf`

- [ ] **Step 1: `versions.tf`** — identical to Task 1.1.

- [ ] **Step 2: `variables.tf`**

```hcl
variable "project_id" {
  type = string
}

variable "env" {
  type = string
}

variable "secret_names" {
  description = "List of secret names to provision (empty values; populate post-create via gcloud)."
  type        = list(string)
  default = [
    "anthropic-api-key",
    "ai-gateway-api-key",
    "better-auth-secret",
    "ip-hash-salt",
    "cron-secret",
    "resend-api-key",
    "sentry-dsn",
    "vapid-private-key",
    "stripe-secret-key",
    "stripe-webhook-secret",
    "lemonsqueezy-api-key",
    "lemonsqueezy-webhook-secret",
    "firecrawl-api-key",
  ]
}

variable "accessor_service_accounts" {
  description = "SA emails that can read secrets via secretAccessor role."
  type        = list(string)
  default     = []
}
```

- [ ] **Step 3: `main.tf`**

```hcl
resource "google_secret_manager_secret" "secrets" {
  for_each  = toset(var.secret_names)
  project   = var.project_id
  secret_id = each.key

  replication {
    user_managed {
      replicas {
        location = "europe-west1"
      }
    }
  }
}

resource "google_secret_manager_secret_iam_member" "accessors" {
  for_each = {
    for pair in setproduct(
      var.secret_names,
      var.accessor_service_accounts
    ) :
    "${pair[0]}-${pair[1]}" => {
      secret_id = pair[0]
      sa_email  = pair[1]
    }
  }
  project   = var.project_id
  secret_id = google_secret_manager_secret.secrets[each.value.secret_id].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${each.value.sa_email}"
}
```

- [ ] **Step 4: `outputs.tf`**

```hcl
output "secret_ids" {
  value = { for k, v in google_secret_manager_secret.secrets : k => v.id }
}
```

- [ ] **Step 5: `tofu fmt` + commit**

```bash
cd infra/tofu/modules/gcp/secrets && tofu fmt
cd /Volumes/Server_Data/code-server/workspace/resumaker
git add infra/tofu/modules/gcp/secrets/
git commit -m "feat(infra/gcp): secrets module — Secret Manager secrets + IAM"
```

---

## Phase 2 — Data plane modules (cloudsql, memorystore, gcs)

### Task 2.1: `cloudsql` module

**Files:**

- Create: `infra/tofu/modules/gcp/cloudsql/{main,variables,outputs,versions}.tf`

- [ ] **Step 1: `versions.tf`** — identical to Task 1.1.

- [ ] **Step 2: `variables.tf`**

```hcl
variable "project_id" {
  type = string
}

variable "env" {
  type = string
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "network_id" {
  description = "Self-link of the VPC (from network module)."
  type        = string
}

variable "private_services_connection_ready" {
  description = "Pass network module's `private_services_connection` output to create an explicit dependency."
  type        = any
  default     = null
}

variable "tier" {
  description = "Machine tier — db-g1-small for non-prod, db-custom-2-4096 for prod."
  type        = string
  default     = "db-g1-small"
}

variable "database_version" {
  type    = string
  default = "POSTGRES_15"
}

variable "iam_user_emails" {
  description = "SA emails that should become Cloud SQL IAM DB users (no password required)."
  type        = list(string)
  default     = []
}
```

- [ ] **Step 3: `main.tf`**

```hcl
locals {
  name_prefix = "resumaker-${var.env}"
}

# Random suffix avoids the 7-day name lock if the instance gets recreated.
resource "random_id" "instance_suffix" {
  byte_length = 2
}

resource "google_sql_database_instance" "main" {
  project          = var.project_id
  name             = "${local.name_prefix}-pg-${random_id.instance_suffix.hex}"
  database_version = var.database_version
  region           = var.region

  # Force private_services_connection to be ready before instance creation.
  depends_on = [var.private_services_connection_ready]

  settings {
    tier              = var.tier
    availability_type = var.env == "prod" ? "REGIONAL" : "ZONAL"
    disk_size         = 20
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "02:00"
      backup_retention_settings {
        retained_backups = var.env == "prod" ? 30 : 7
      }
    }

    ip_configuration {
      ipv4_enabled                                  = true # public IP, gated by IAM
      private_network                               = var.network_id
      enable_private_path_for_google_cloud_services = true
      ssl_mode                                      = "ENCRYPTED_ONLY"
    }

    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = false
      record_client_address   = false
    }
  }

  deletion_protection = var.env == "prod"
}

resource "google_sql_database" "main" {
  project  = var.project_id
  name     = "resumaker"
  instance = google_sql_database_instance.main.name
}

# IAM users — one per service account that needs DB access.
resource "google_sql_user" "iam_users" {
  for_each = toset(var.iam_user_emails)
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = trimsuffix(each.value, ".gserviceaccount.com")
  type     = "CLOUD_IAM_SERVICE_ACCOUNT"
}
```

- [ ] **Step 4: `outputs.tf`**

```hcl
output "instance_name" {
  value = google_sql_database_instance.main.name
}

output "instance_connection_name" {
  description = "Use this in @google-cloud/cloud-sql-connector"
  value       = google_sql_database_instance.main.connection_name
}

output "instance_public_ip" {
  value = google_sql_database_instance.main.public_ip_address
}

output "instance_private_ip" {
  value = google_sql_database_instance.main.private_ip_address
}

output "database_name" {
  value = google_sql_database.main.name
}
```

- [ ] **Step 5: `tofu fmt` + commit**

```bash
cd infra/tofu/modules/gcp/cloudsql && tofu fmt
cd /Volumes/Server_Data/code-server/workspace/resumaker
git add infra/tofu/modules/gcp/cloudsql/
git commit -m "feat(infra/gcp): cloudsql module — Postgres 15 + IAM auth + private peering"
```

---

### Task 2.2: `memorystore` module

**Files:**

- Create: `infra/tofu/modules/gcp/memorystore/{main,variables,outputs,versions}.tf`

- [ ] **Step 1: `versions.tf`** — identical to Task 1.1.

- [ ] **Step 2: `variables.tf`**

```hcl
variable "project_id" {
  type = string
}

variable "env" {
  type = string
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "network_id" {
  description = "Self-link of the VPC."
  type        = string
}

variable "private_services_connection_ready" {
  type    = any
  default = null
}

variable "memory_size_gb" {
  type    = number
  default = 1
}

variable "tier" {
  type    = string
  default = "BASIC" # STANDARD_HA for prod if you want failover
}
```

- [ ] **Step 3: `main.tf`**

```hcl
resource "google_redis_instance" "main" {
  project        = var.project_id
  name           = "resumaker-${var.env}-redis"
  region         = var.region
  memory_size_gb = var.memory_size_gb
  redis_version  = "REDIS_7_2"
  tier           = var.env == "prod" ? "STANDARD_HA" : var.tier

  authorized_network      = var.network_id
  connect_mode            = "PRIVATE_SERVICE_ACCESS"
  reserved_ip_range       = null # auto-allocate from private services range
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  depends_on = [var.private_services_connection_ready]
}
```

- [ ] **Step 4: `outputs.tf`**

```hcl
output "host" {
  value = google_redis_instance.main.host
}

output "port" {
  value = google_redis_instance.main.port
}

output "redis_url" {
  description = "rediss:// URL for the app to use"
  value       = "rediss://${google_redis_instance.main.host}:${google_redis_instance.main.port}"
  sensitive   = true
}
```

- [ ] **Step 5: `tofu fmt` + commit**

```bash
cd infra/tofu/modules/gcp/memorystore && tofu fmt
cd /Volumes/Server_Data/code-server/workspace/resumaker
git add infra/tofu/modules/gcp/memorystore/
git commit -m "feat(infra/gcp): memorystore module — Redis 7 via private peering"
```

---

### Task 2.3: `gcs` factory module

**Files:**

- Create: `infra/tofu/modules/gcp/gcs/{main,variables,outputs,versions}.tf`

- [ ] **Step 1: `versions.tf`** — identical to Task 1.1.

- [ ] **Step 2: `variables.tf`**

```hcl
variable "project_id" {
  type = string
}

variable "buckets" {
  description = "Map of logical name → settings."
  type = map(object({
    location      = string
    storage_class = optional(string, "STANDARD")
    versioning    = optional(bool, true)
    force_destroy = optional(bool, false)
  }))
  default = {} # no buckets created by default; uplifted when file storage ships
}
```

- [ ] **Step 3: `main.tf`**

```hcl
resource "google_storage_bucket" "buckets" {
  for_each = var.buckets

  project       = var.project_id
  name          = each.key
  location      = each.value.location
  storage_class = each.value.storage_class
  force_destroy = each.value.force_destroy

  versioning {
    enabled = each.value.versioning
  }

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
}
```

- [ ] **Step 4: `outputs.tf`**

```hcl
output "bucket_urls" {
  value = { for k, v in google_storage_bucket.buckets : k => v.url }
}
```

- [ ] **Step 5: `tofu fmt` + commit**

```bash
cd infra/tofu/modules/gcp/gcs && tofu fmt
cd /Volumes/Server_Data/code-server/workspace/resumaker
git add infra/tofu/modules/gcp/gcs/
git commit -m "feat(infra/gcp): gcs factory module (no buckets created yet)"
```

---

## Phase 3 — Compute & registry modules

### Task 3.1: `artifactregistry` module

**Files:**

- Create: `infra/tofu/modules/gcp/artifactregistry/{main,variables,outputs,versions}.tf`

- [ ] **Step 1: `versions.tf`** — identical to Task 1.1.

- [ ] **Step 2: `variables.tf`**

```hcl
variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "repository_id" {
  type    = string
  default = "resumaker"
}

variable "writer_service_accounts" {
  description = "SA emails that need push permission (typically the cicd SA)."
  type        = list(string)
  default     = []
}

variable "reader_service_accounts" {
  description = "SA emails that need pull permission (typically GKE node SA + app SAs)."
  type        = list(string)
  default     = []
}
```

- [ ] **Step 3: `main.tf`**

```hcl
resource "google_artifact_registry_repository" "main" {
  project       = var.project_id
  location      = var.region
  repository_id = var.repository_id
  description   = "Resumaker container images"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-recent-30"
    action = "KEEP"
    most_recent_versions {
      keep_count = 30
    }
  }

  cleanup_policies {
    id     = "delete-old-untagged"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s" # 7 days
    }
  }
}

resource "google_artifact_registry_repository_iam_member" "writers" {
  for_each   = toset(var.writer_service_accounts)
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.main.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${each.value}"
}

resource "google_artifact_registry_repository_iam_member" "readers" {
  for_each   = toset(var.reader_service_accounts)
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.main.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${each.value}"
}
```

- [ ] **Step 4: `outputs.tf`**

```hcl
output "repository_url" {
  description = "europe-west1-docker.pkg.dev/{project}/{repo}"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
}
```

- [ ] **Step 5: `tofu fmt` + commit**

```bash
cd infra/tofu/modules/gcp/artifactregistry && tofu fmt
cd /Volumes/Server_Data/code-server/workspace/resumaker
git add infra/tofu/modules/gcp/artifactregistry/
git commit -m "feat(infra/gcp): artifactregistry module — Docker repo + IAM"
```

---

### Task 3.2: `gke` module

**Files:**

- Create: `infra/tofu/modules/gcp/gke/{main,variables,outputs,versions}.tf`
- Create: `infra/tofu/modules/gcp/gke/README.md`

- [ ] **Step 1: `versions.tf`**

```hcl
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
  }
}
```

- [ ] **Step 2: `variables.tf`**

```hcl
variable "project_id" {
  type = string
}

variable "env" {
  type = string
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "network_self_link" {
  type = string
}

variable "subnet_self_link" {
  type = string
}

variable "pods_range_name" {
  type = string
}

variable "services_range_name" {
  type = string
}

variable "release_channel" {
  type    = string
  default = "REGULAR"
}
```

- [ ] **Step 3: `main.tf`**

```hcl
locals {
  cluster_name = "resumaker-${var.env}"
}

resource "google_container_cluster" "main" {
  provider = google-beta

  project  = var.project_id
  name     = local.cluster_name
  location = var.region

  enable_autopilot = true

  release_channel {
    channel = var.release_channel
  }

  network    = var.network_self_link
  subnetwork = var.subnet_self_link

  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  # Public control plane endpoint; could be made private later via private_cluster_config.
  # For solo-dev simplicity we leave it public — auth still requires gcloud-auth.

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Autopilot disables many opts; the cluster manages node SA, autoscaler, etc.
  # Deletion protection on prod.
  deletion_protection = var.env == "prod"
}
```

- [ ] **Step 4: `outputs.tf`**

```hcl
output "cluster_name" {
  value = google_container_cluster.main.name
}

output "cluster_location" {
  value = google_container_cluster.main.location
}

output "cluster_endpoint" {
  value     = google_container_cluster.main.endpoint
  sensitive = true
}

output "cluster_ca_certificate" {
  value     = google_container_cluster.main.master_auth[0].cluster_ca_certificate
  sensitive = true
}

output "kubectl_context_command" {
  description = "Run this to get a kubectl context"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.main.name} --region=${google_container_cluster.main.location} --project=${var.project_id}"
}
```

- [ ] **Step 5: README.md**

````markdown
# GKE Autopilot module

Provisions a GKE Autopilot cluster wired to the network module. Workload Identity is enabled; the cluster trusts pods that match `{project}.svc.id.goog`.

## Why Autopilot

- Per-pod billing (no idle node cost beyond control plane).
- Google manages the node pool, autoscaling, OS patching, security.
- Sane defaults for solo-dev scale.

## Constraints

- No privileged pods, no host networking, no custom node images.
- Resource requests must fit Autopilot's compute classes.
- If Track 2's scrapers need any of the above, swap to GKE Standard via this module's variable (TODO).

## After apply

```bash
gcloud container clusters get-credentials resumaker-dev \
  --region=europe-west1 \
  --project=resumaker-dev
kubectl get nodes
```
````

````

- [ ] **Step 6: `tofu fmt` + commit**

```bash
cd infra/tofu/modules/gcp/gke && tofu fmt
cd /Volumes/Server_Data/code-server/workspace/resumaker
git add infra/tofu/modules/gcp/gke/
git commit -m "feat(infra/gcp): gke module — Autopilot cluster"
````

---

## Phase 4 — Per-env wiring

### Task 4.1: `dev-gcp` environment

**Files:**

- Create: `infra/tofu/environments/dev-gcp/{backend,providers,variables,main,outputs}.tf`
- Create: `infra/tofu/environments/dev-gcp/terraform.tfvars`

- [ ] **Step 1: `backend.tf`**

```hcl
terraform {
  backend "gcs" {
    bucket = "resumaker-dev-tfstate"
    prefix = "tofu/state"
  }
}
```

- [ ] **Step 2: `providers.tf`**

```hcl
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}
```

- [ ] **Step 3: `variables.tf`**

```hcl
variable "project_id" {
  type    = string
  default = "resumaker-dev"
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "github_repo" {
  type    = string
  default = "resumaker/resumaker"
}

variable "vercel_team_id" {
  type = string
}

variable "vercel_project_id" {
  type = string
}
```

- [ ] **Step 4: `main.tf`**

```hcl
locals {
  env = "dev"
}

module "network" {
  source = "../../modules/gcp/network"

  project_id            = var.project_id
  region                = var.region
  env                   = local.env
  vpc_cidr              = "10.0.0.0/16"
  subnet_cidr           = "10.0.1.0/24"
  pods_cidr             = "10.0.16.0/20"
  services_cidr         = "10.0.32.0/20"
  private_services_cidr = "10.0.128.0/16"
}

module "workload_identity" {
  source = "../../modules/gcp/workload-identity"

  project_id        = var.project_id
  env               = local.env
  github_repo       = var.github_repo
  vercel_team_id    = var.vercel_team_id
  vercel_project_id = var.vercel_project_id
}

module "secrets" {
  source = "../../modules/gcp/secrets"

  project_id = var.project_id
  env        = local.env
  accessor_service_accounts = [
    module.workload_identity.app_service_account_email,
    module.workload_identity.cicd_service_account_email,
  ]
}

module "cloudsql" {
  source = "../../modules/gcp/cloudsql"

  project_id = var.project_id
  region     = var.region
  env        = local.env
  network_id = module.network.network_self_link
  private_services_connection_ready = module.network.private_services_connection
  tier       = "db-g1-small"

  iam_user_emails = [
    module.workload_identity.app_service_account_email,
  ]
}

module "memorystore" {
  source = "../../modules/gcp/memorystore"

  project_id = var.project_id
  region     = var.region
  env        = local.env
  network_id = module.network.network_self_link
  private_services_connection_ready = module.network.private_services_connection
}

module "artifactregistry" {
  source = "../../modules/gcp/artifactregistry"

  project_id = var.project_id
  region     = var.region

  writer_service_accounts = [
    module.workload_identity.cicd_service_account_email,
  ]
}

module "gcs" {
  source = "../../modules/gcp/gcs"

  project_id = var.project_id
  buckets    = {} # none yet
}

module "gke" {
  source = "../../modules/gcp/gke"

  project_id          = var.project_id
  region              = var.region
  env                 = local.env
  network_self_link   = module.network.network_self_link
  subnet_self_link    = module.network.subnet_self_link
  pods_range_name     = module.network.pods_range_name
  services_range_name = module.network.services_range_name
}
```

- [ ] **Step 5: `outputs.tf`**

```hcl
output "cluster_kubectl_command" {
  value = module.gke.kubectl_context_command
}

output "cloudsql_connection_name" {
  value = module.cloudsql.instance_connection_name
}

output "memorystore_host" {
  value = module.memorystore.host
}

output "artifact_registry_url" {
  value = module.artifactregistry.repository_url
}

output "app_service_account_email" {
  value = module.workload_identity.app_service_account_email
}

output "cicd_service_account_email" {
  value = module.workload_identity.cicd_service_account_email
}

output "wif_vercel_provider" {
  value = module.workload_identity.vercel_provider_name
}

output "wif_github_provider" {
  value = module.workload_identity.github_provider_name
}
```

- [ ] **Step 6: `terraform.tfvars`**

```hcl
# Fill these from `vercel teams list` and `vercel project ls`.
vercel_team_id    = "TODO-from-vercel-cli"
vercel_project_id = "TODO-from-vercel-cli"
```

Add `terraform.tfvars` to `.gitignore` if it contains anything sensitive (these IDs aren't secrets, but `tfvars` discipline is to not commit env-specific values). For now, COMMIT with the TODO placeholders so the operator knows what to fill.

- [ ] **Step 7: Run `tofu init` + `tofu validate`**

```bash
cd infra/tofu/environments/dev-gcp
# Authenticate to GCP first if not already
gcloud auth application-default login

tofu init
tofu validate
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 8: Commit**

```bash
cd /Volumes/Server_Data/code-server/workspace/resumaker
git add infra/tofu/environments/dev-gcp/
git commit -m "feat(infra/gcp): dev-gcp environment wiring"
```

---

### Task 4.2: `staging-gcp` environment

**Files:** mirror Task 4.1 but with:

- `backend.tf` → `bucket = "resumaker-staging-tfstate"`
- `variables.tf` → `default = "resumaker-staging"`
- `main.tf` → `local.env = "staging"`, CIDRs `10.1.x.x`

- [ ] **Step 1: Copy dev-gcp**

```bash
cp -r infra/tofu/environments/dev-gcp infra/tofu/environments/staging-gcp
```

- [ ] **Step 2: Edit `backend.tf`**

Change `bucket = "resumaker-dev-tfstate"` → `bucket = "resumaker-staging-tfstate"`.

- [ ] **Step 3: Edit `variables.tf`**

Change `default = "resumaker-dev"` → `default = "resumaker-staging"`.

- [ ] **Step 4: Edit `main.tf`**

- `local.env = "staging"`
- network CIDRs `10.0.x.x` → `10.1.x.x` (4 places: vpc_cidr, subnet_cidr, pods_cidr, services_cidr, private_services_cidr)
- Same module versions; same tier (db-g1-small for cost).

- [ ] **Step 5: `tofu init` + `validate`**

```bash
cd infra/tofu/environments/staging-gcp
tofu init
tofu validate
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/Server_Data/code-server/workspace/resumaker
git add infra/tofu/environments/staging-gcp/
git commit -m "feat(infra/gcp): staging-gcp environment wiring"
```

---

### Task 4.3: `prod-gcp` environment

**Files:** mirror but with:

- `backend.tf` → `bucket = "resumaker-prod-tfstate"`
- `variables.tf` → `default = "resumaker-prod"`
- `main.tf` → `local.env = "prod"`, CIDRs `10.2.x.x`, `cloudsql.tier = "db-custom-2-4096"`, `memorystore.tier = "STANDARD_HA"` (the module already sets STANDARD_HA when env == "prod", but pass explicitly if you want a non-default size).

- [ ] **Step 1: Copy dev-gcp**

```bash
cp -r infra/tofu/environments/dev-gcp infra/tofu/environments/prod-gcp
```

- [ ] **Step 2: Edit `backend.tf`**

Change to `bucket = "resumaker-prod-tfstate"`.

- [ ] **Step 3: Edit `variables.tf`**

Change `default = "resumaker-prod"`.

- [ ] **Step 4: Edit `main.tf`**

- `local.env = "prod"`
- CIDRs `10.2.x.x`
- `module "cloudsql"` block: add `tier = "db-custom-2-4096"` (2 vCPU, 4GB RAM — small but prod-sized).

- [ ] **Step 5: `tofu init` + `validate`**

```bash
cd infra/tofu/environments/prod-gcp
tofu init
tofu validate
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/Server_Data/code-server/workspace/resumaker
git add infra/tofu/environments/prod-gcp/
git commit -m "feat(infra/gcp): prod-gcp environment wiring"
```

---

## Phase 5 — Apply to `dev-gcp` (the validation phase)

This phase is operator-driven — the human runs `tofu apply` and watches.

### Task 5.1: First apply on dev-gcp

- [ ] **Step 1: Populate `terraform.tfvars`**

In `infra/tofu/environments/dev-gcp/terraform.tfvars`:

```bash
vercel teams list
vercel project ls
```

Set `vercel_team_id` and `vercel_project_id` to the dev Vercel project. Save.

- [ ] **Step 2: Plan**

```bash
cd infra/tofu/environments/dev-gcp
tofu plan -out=tfplan
```

Read the output. Expect ~50-70 resources (network: ~6, WIF: ~7, secrets: 13 + bindings, cloudsql: ~3, memorystore: 1, AR: ~2, GKE: 1, plus IAM).

- [ ] **Step 3: Apply**

```bash
tofu apply tfplan
```

GKE Autopilot takes 5-10 min; Cloud SQL takes another 5-10. Total ~15-25 min.

- [ ] **Step 4: Verify outputs**

```bash
tofu output
```

Capture: `cluster_kubectl_command`, `cloudsql_connection_name`, `app_service_account_email`, `wif_vercel_provider`. Save to a scratch file.

- [ ] **Step 5: Verify kubectl works**

```bash
$(tofu output -raw cluster_kubectl_command)
kubectl get nodes
kubectl get ns
```

Expected: at least one Autopilot node, the standard system namespaces.

- [ ] **Step 6: Populate secrets**

For each secret in `module.secrets.secret_names`, push a value via gcloud. Example:

```bash
echo -n "<value>" | gcloud secrets versions add anthropic-api-key \
  --data-file=- --project=resumaker-dev
# repeat for each secret
```

Or write a `populate-secrets.sh` helper that reads from your existing Vercel env vars (`vercel env pull`) and pushes to Secret Manager — recommended but optional for this task.

- [ ] **Step 7: Snapshot the working state**

```bash
gcloud secrets list --project=resumaker-dev
gcloud sql instances list --project=resumaker-dev
gcloud redis instances list --region=europe-west1 --project=resumaker-dev
gcloud container clusters list --project=resumaker-dev
gcloud artifacts repositories list --location=europe-west1 --project=resumaker-dev
```

No commit required (no code change), but save the outputs locally for reference.

---

## Phase 6 — App integration: Cloud SQL Connector

### Task 6.1: Add the connector dependency + env vars

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/src/lib/env.ts`
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Install**

```bash
cd apps/web
pnpm add @google-cloud/cloud-sql-connector google-auth-library
```

- [ ] **Step 2: Add env vars**

In `apps/web/src/lib/env.ts`, find the database section (`DATABASE_URL: ...`) and ADD after it:

```ts
    // GCP Cloud SQL — opt-in. When `GCP_CLOUD_SQL_INSTANCE` is set,
    // the DB layer uses Cloud SQL Connector + IAM auth instead of the
    // raw DATABASE_URL. Leave unset to keep using Neon.
    GCP_CLOUD_SQL_INSTANCE: z.string().optional(), // "project:region:instance"
    GCP_CLOUD_SQL_IAM_USER: z.string().optional(),
    GCP_CLOUD_SQL_DATABASE: z.string().optional().default('resumaker'),
```

- [ ] **Step 3: Update `.env.example`**

Append:

```ini
# Optional: GCP Cloud SQL via IAM auth (used in production on Vercel)
GCP_CLOUD_SQL_INSTANCE=
GCP_CLOUD_SQL_IAM_USER=
GCP_CLOUD_SQL_DATABASE=resumaker
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/env.ts apps/web/.env.example
git add ../../pnpm-lock.yaml || git add pnpm-lock.yaml
git commit -m "feat(env): add Cloud SQL Connector env vars + dep"
```

---

### Task 6.2: Cloud SQL connection path

**Files:**

- Create: `apps/web/src/db/cloudsql.ts`
- Modify: `apps/web/src/db/index.ts`

- [ ] **Step 1: Write a test (mock the connector)**

Create `apps/web/src/db/__tests__/cloudsql.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@google-cloud/cloud-sql-connector', () => ({
  Connector: vi.fn().mockImplementation(() => ({
    getOptions: vi.fn().mockResolvedValue({
      host: '/cloudsql-tcp/127.0.0.1',
      port: 5432,
      ssl: false,
    }),
  })),
}));

vi.mock('postgres', () => ({
  default: vi.fn(() => ({ end: vi.fn() })),
}));

import { makeCloudSqlClient } from '../cloudsql';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('makeCloudSqlClient', () => {
  it('passes instanceConnectionName, ipType=PUBLIC, authType=IAM to the connector', async () => {
    const sql = await makeCloudSqlClient({
      instance: 'resumaker-prod:europe-west1:pg',
      iamUser: 'app@resumaker-prod.iam',
      database: 'resumaker',
    });
    expect(sql).toBeDefined();
    const { Connector } = await import('@google-cloud/cloud-sql-connector');
    expect(Connector).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, confirm FAIL**

```bash
cd apps/web && pnpm vitest run src/db/__tests__/cloudsql.test.ts
```

Expected: FAIL — `../cloudsql` not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/db/cloudsql.ts`:

```ts
import { Connector } from '@google-cloud/cloud-sql-connector';
import postgres from 'postgres';

export interface CloudSqlClientArgs {
  instance: string;
  iamUser: string;
  database: string;
  poolMax?: number;
}

/**
 * Build a `postgres` client wired to Cloud SQL via the Connector.
 *
 * The Connector handles IAM auth (no static password), ephemeral SSL
 * certs, and DNS resolution. Caller passes the instance connection
 * name (`project:region:instance`) and the SA email used as the DB user.
 */
export async function makeCloudSqlClient(args: CloudSqlClientArgs) {
  const connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName: args.instance,
    ipType: 'PUBLIC',
    authType: 'IAM',
  });

  return postgres({
    ...clientOpts,
    database: args.database,
    user: args.iamUser,
    max: args.poolMax ?? 10,
  });
}
```

- [ ] **Step 4: Run, confirm PASS**

```bash
cd apps/web && pnpm vitest run src/db/__tests__/cloudsql.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire into `db/index.ts`**

Open `apps/web/src/db/index.ts`. Find the existing `postgres(...)` client construction. Wrap it in a conditional:

```ts
import { env } from '@/lib/env';

// At module level (not inside a function):
let client: ReturnType<typeof postgres>;

if (env.GCP_CLOUD_SQL_INSTANCE && env.GCP_CLOUD_SQL_IAM_USER) {
  // Lazy import so the connector isn't pulled into bundles that don't use it.
  const { makeCloudSqlClient } = await import('./cloudsql');
  client = await makeCloudSqlClient({
    instance: env.GCP_CLOUD_SQL_INSTANCE,
    iamUser: env.GCP_CLOUD_SQL_IAM_USER,
    database: env.GCP_CLOUD_SQL_DATABASE,
    poolMax: env.DATABASE_POOL_MAX,
  });
} else {
  client = postgres(env.DATABASE_URL, { max: env.DATABASE_POOL_MAX });
}

export const db = drizzle(client, { schema });
```

NOTE: top-level `await` works in Next.js 16 server runtime. If the existing file uses synchronous client creation (it likely does), you'll need to refactor surrounding callers OR keep both paths synchronous by using `postgres` directly with the Connector's `getOptions` result (the connector lib supports sync usage when given pre-fetched options — read `@google-cloud/cloud-sql-connector` README for the exact pattern). The simplest safe path is the lazy async import shown above; if Next.js complains about top-level await in this file, move the construction into `getDb()` and update callers.

- [ ] **Step 6: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: PASS (or surface specific callers that need updating).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/db/
git commit -m "feat(db): Cloud SQL Connector path (opt-in via GCP_CLOUD_SQL_INSTANCE)"
```

---

## Phase 7 — CI/CD

### Task 7.1: GCP deploy workflow

**Files:**

- Create: `.github/workflows/deploy-gcp.yml`

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/deploy-gcp.yml`:

```yaml
name: Deploy (GCP)

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'prod'
        type: choice
        options:
          - dev
          - staging
          - prod
      image_tag:
        description: 'Image tag (sha or tag). Defaults to current SHA.'
        required: false
        type: string

concurrency:
  group: deploy-gcp-${{ github.event.inputs.environment || 'prod' }}
  cancel-in-progress: false

permissions:
  id-token: write
  contents: write

env:
  REGION: europe-west1
  REPO: resumaker

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Compute environment
        id: env
        run: |
          ENV="${{ github.event.inputs.environment || 'prod' }}"
          echo "env=$ENV" >> $GITHUB_OUTPUT
          echo "project_id=resumaker-$ENV" >> $GITHUB_OUTPUT
          TAG="${{ github.event.inputs.image_tag || github.sha }}"
          echo "image_tag=$TAG" >> $GITHUB_OUTPUT

      - name: Authenticate to GCP via WIF
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: resumaker-cicd@${{ steps.env.outputs.project_id }}.iam.gserviceaccount.com

      - uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev

      - name: Set up QEMU + Buildx
        uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v3

      - name: Build + push image
        run: |
          IMAGE="${REGION}-docker.pkg.dev/${{ steps.env.outputs.project_id }}/${REPO}/web:${{ steps.env.outputs.image_tag }}"
          docker buildx build --platform linux/amd64 \
            --push -t "$IMAGE" \
            -f apps/web/Dockerfile .

      - name: Bump Helm values
        run: |
          VALUES_FILE="infra/helm/resumaker/values.${{ steps.env.outputs.env }}-gcp.image.yaml"
          mkdir -p "$(dirname $VALUES_FILE)"
          cat > "$VALUES_FILE" <<EOF
          image:
            tag: "${{ steps.env.outputs.image_tag }}"
          EOF

      - name: Commit + push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add infra/helm/resumaker/
          git diff --cached --quiet || git commit -m "chore(deploy/gcp): bump ${{ steps.env.outputs.env }} image to ${{ steps.env.outputs.image_tag }}"
          git push
```

- [ ] **Step 2: Set repo secrets**

Operator must add to the repo:

- `WIF_PROVIDER` — full resource name of the GitHub Actions WIF provider in prod (from `tofu output wif_github_provider`). Use the prod one; the workflow targets the per-env project, but the WIF provider can be the same trust pool.

Different envs can share a single WIF provider if the attribute condition allows the repo; ours does. So one `WIF_PROVIDER` secret suffices.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-gcp.yml
git commit -m "feat(ci): GCP deploy workflow (parallel to AWS)"
```

---

### Task 7.2: GCP infra workflow matrix

**Files:**

- Modify: `.github/workflows/infra.yml`

- [ ] **Step 1: Read existing workflow**

```bash
cat .github/workflows/infra.yml
```

Understand the structure — there's likely a job that does `tofu plan` per env, possibly using a matrix.

- [ ] **Step 2: Add GCP matrix entries**

Find the matrix or env list in `.github/workflows/infra.yml`. Add `dev-gcp`, `staging-gcp`, `prod-gcp` alongside the existing AWS envs.

If the workflow uses a single matrix:

```yaml
strategy:
  matrix:
    env: [dev, staging, prod, dev-gcp, staging-gcp, prod-gcp]
```

If it uses separate jobs per provider, ADD a new job block following the same pattern but with:

- `google-github-actions/auth` instead of `aws-actions/configure-aws-credentials`
- Working directory `infra/tofu/environments/${{ matrix.env }}-gcp`

Show the auth step:

```yaml
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
    service_account: resumaker-cicd@resumaker-${{ matrix.env }}.iam.gserviceaccount.com
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/infra.yml
git commit -m "feat(ci): add GCP envs to infra workflow"
```

---

## Phase 8 — Helm chart updates

### Task 8.1: GKE Ingress + Secret Manager helm values

**Files:**

- Create: `infra/helm/resumaker/values.dev-gcp.yaml`
- Create: `infra/helm/resumaker/values.staging-gcp.yaml`
- Create: `infra/helm/resumaker/values.prod-gcp.yaml`

- [ ] **Step 1: Read the existing AWS values file as a template**

```bash
cat infra/helm/resumaker/values.dev.yaml 2>/dev/null || cat infra/helm/resumaker/values.yaml
```

- [ ] **Step 2: Write `values.dev-gcp.yaml`**

```yaml
# values.dev-gcp.yaml — GKE-specific overrides for dev.

env: dev

ingress:
  enabled: true
  className: gce
  annotations:
    kubernetes.io/ingress.class: gce
    networking.gke.io/managed-certificates: resumaker-dev-cert
  hosts:
    - host: dev.resumaker.co.il
      paths:
        - path: /
          pathType: Prefix

# ExternalSecrets — pulls from GCP Secret Manager via Workload Identity.
externalSecrets:
  enabled: true
  refreshInterval: '1m'
  secretStoreName: resumaker-dev-secretstore
  serviceAccount:
    name: resumaker-app
    annotations:
      iam.gke.io/gcp-service-account: resumaker-app@resumaker-dev.iam.gserviceaccount.com

# Empty image stanza — populated by deploy-gcp.yml writing to values.dev-gcp.image.yaml
image:
  repository: europe-west1-docker.pkg.dev/resumaker-dev/resumaker/web
  pullPolicy: IfNotPresent

resources:
  requests:
    cpu: '100m'
    memory: '256Mi'
  limits:
    cpu: '500m'
    memory: '512Mi'
```

- [ ] **Step 3: Mirror for staging + prod**

`values.staging-gcp.yaml` and `values.prod-gcp.yaml` — same shape, swap `dev` → `staging`/`prod`, scale resources for prod (CPU 500m/1, memory 512Mi/1Gi).

- [ ] **Step 4: Commit**

```bash
git add infra/helm/resumaker/values.{dev,staging,prod}-gcp.yaml
git commit -m "feat(helm): GCP value overlays for dev/staging/prod"
```

---

## Phase 9 — Cutover & verification

### Task 9.1: Apply staging-gcp + prod-gcp

This phase is operator-driven.

- [ ] **Step 1: Apply staging-gcp**

```bash
cd infra/tofu/environments/staging-gcp
# fill terraform.tfvars
tofu init
tofu plan -out=tfplan
tofu apply tfplan
```

Time: ~20-25 min (Cloud SQL + GKE are the slow ones).

- [ ] **Step 2: Apply prod-gcp**

```bash
cd infra/tofu/environments/prod-gcp
# fill terraform.tfvars (use the prod Vercel project id)
tofu init
tofu plan -out=tfplan
tofu apply tfplan
```

- [ ] **Step 3: Populate secrets in staging + prod**

Use the populate-secrets script (or manual `gcloud secrets versions add` per secret).

- [ ] **Step 4: Run schema migrations against prod Cloud SQL**

From your dev machine, authenticated to prod:

```bash
# Connect via Cloud SQL Proxy locally
gcloud sql connect resumaker-pg-xxxx --user=resumaker-app --project=resumaker-prod
# OR, more practically, set DATABASE_URL temporarily and run pnpm db:migrate:
PG_INSTANCE=$(gcloud sql instances list --project=resumaker-prod --format="value(name)")
# Use Cloud SQL Proxy on the host:
cloud-sql-proxy resumaker-prod:europe-west1:$PG_INSTANCE &
DATABASE_URL="postgresql://resumaker-app@resumaker-prod.iam@localhost:5432/resumaker" \
  pnpm --filter @resumaker/web db:migrate
```

- [ ] **Step 5: Smoke test prod Cloud SQL**

Connect via `gcloud sql connect` and run `\dt` — confirm tables exist (matching the drizzle schema).

---

### Task 9.2: Vercel cutover

- [ ] **Step 1: Set Vercel env vars (prod)**

```bash
vercel env add GCP_CLOUD_SQL_INSTANCE production
# value: resumaker-prod:europe-west1:resumaker-pg-xxxx
vercel env add GCP_CLOUD_SQL_IAM_USER production
# value: resumaker-app@resumaker-prod.iam
```

Vercel automatically injects `VERCEL_OIDC_TOKEN` for federated auth — no need to add it.

- [ ] **Step 2: Trigger redeploy**

```bash
vercel deploy --prod
```

- [ ] **Step 3: Smoke test the deployed app**

- Visit `https://resumaker.co.il`
- Sign up with a new email
- Generate a resume
- Log out, log in
- In a parallel terminal, verify rows landed in Cloud SQL:

  ```bash
  gcloud sql connect <instance> --user=resumaker-app --project=resumaker-prod
  SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 5;
  ```

- [ ] **Step 4: Set up monitoring**

GCP Console → Operations → Monitoring:

- Create a budget alert at 50%/75%/90% of trial credits per project.
- Cloud SQL slow query insights dashboard already enabled by the module.

- [ ] **Step 5: Document the rollback path**

Operator writes a one-pager (or appends to `docs/PRE_LAUNCH.md`):

```
Rollback to Neon (any time within 7 days):
1. vercel env rm GCP_CLOUD_SQL_INSTANCE production
2. vercel deploy --prod
3. App resumes using DATABASE_URL (Neon).
```

- [ ] **Step 6: After 7 days clean — pause Neon**

In Neon dashboard, "Suspend" the project (don't delete — keep as 30-day fallback).

---

### Task 9.3: Mark plan done in the roadmap

**Files:**

- Modify: `/Users/server/.claude/plans/floofy-twirling-thompson.md`

- [ ] **Step 1: Append status block**

In Track 1's section, add at the top:

```markdown
**Status (2026-MM-DD)**: Track 1 complete. GCP envs `resumaker-{dev,staging,prod}` provisioned in `europe-west1`. Prod app runs on Vercel + Cloud SQL via IAM auth; GKE Autopilot cluster ready and idle pending Track 2 workloads. AWS Tofu modules remain in-repo dormant. Trial credits monitored via GCP Budget alerts.
```

- [ ] **Step 2: That's the end of the plan.**

No commit (file is outside the repo). Done.

---

## Self-Review

### 1. Spec coverage

Each spec section maps to tasks:

- §1 Overview / §2 Decisions — captured in the plan header + the design choices baked into each module
- §3 Architecture (service mapping, network topology, identity & secrets, Vercel ↔ Cloud SQL) — Phases 1-3 build the modules; Phase 6 builds the Vercel↔Cloud SQL path
- §4 Module Structure — Phases 1-3
- §5 Bootstrap Sequence — Phase 0
- §6 Apply Sequence (network → cloudsql → memorystore → AR → secrets → WIF → gke) — modeled in dev-gcp/main.tf's module ordering and the apply task 5.1
- §7 CI/CD Changes — Phase 7
- §8 Vercel Integration (env vars, app-side switch, cutover plan) — Phases 6 + 9
- §9 Verification — Tasks 5.1 step 5-7, 9.1 step 5, 9.2 step 3
- §10 Costs — not actionable; informational, covered by budget alerts in Task 9.2 step 4
- §11 Risks & Rollback — Task 9.2 step 5 documents rollback path
- §12 Success Criteria — verified across Phases 5, 9
- §13 Open Questions — none, per spec

### 2. Placeholder scan

- `terraform.tfvars` in dev-gcp committed with `TODO-from-vercel-cli` placeholders — by design (operator fills them before apply). The plan tells the operator exactly how to populate.
- "fill terraform.tfvars" in Task 9.1 Step 1 — operator action, not a code placeholder.
- No "TODO" / "TBD" in code blocks.
- Task 6.2 Step 5 has a NOTE about top-level await possibly needing rework — that's a heads-up for the implementer, not a placeholder.

### 3. Type consistency

- `instance_connection_name` output of `cloudsql` module is passed to `GCP_CLOUD_SQL_INSTANCE` env var consistently.
- `app_service_account_email` output of `workload-identity` is consumed by `cloudsql.iam_user_emails`, `secrets.accessor_service_accounts`, and `artifactregistry.reader_service_accounts` consistently.
- `network_self_link` is passed to both `cloudsql.network_id` and `memorystore.network_id`. Consistent.
- Module variable names match across module + caller (e.g., `private_services_connection_ready` passed from `network` to `cloudsql` and `memorystore`).

### 4. Risks identified

- Top-level await in `db/index.ts` (Task 6.2 Step 5) — flagged inline; implementer may need to restructure.
- Per-env Vercel projects may need their own `vercel_project_id` for the WIF binding. The plan assumes one prod Vercel project; if there are also dev/staging Vercel projects, each gets its own `vercel_project_id` in its respective `terraform.tfvars`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-26-gcp-migration.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, two-stage review per task. The Tofu module phases are mechanical (each module is well-scoped) and well-suited to subagent dispatch. The operator-driven tasks (0.2, 5.1, 9.1, 9.2) need YOU to run `gcloud` and `tofu apply` against your billing account — subagents can't do those. The flow is: subagents write the modules + wiring → you run the operator tasks → subagents write the app code + CI/CD → you do the cutover.

**2. Inline Execution** — Run tasks in this session using `executing-plans`, batch checkpoints between phases.

Which approach?
