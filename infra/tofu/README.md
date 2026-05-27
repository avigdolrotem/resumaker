# Infrastructure (OpenTofu)

> Infrastructure-as-code for **GCP**. Defines VPC, GKE Autopilot, Cloud SQL,
> Memorystore, GCS, Artifact Registry, Secret Manager, and Workload Identity
> Federation for GitHub Actions.

## Layout

```
infra/tofu/
├── modules/                  # Reusable modules
│   ├── network/              # VPC + Cloud NAT + Private Services Access
│   ├── gke/                  # Autopilot cluster with Workload Identity
│   ├── cloudsql/             # Postgres with IAM auth + Cloud SQL Connector
│   ├── memorystore/          # Redis (1GB basic)
│   ├── gcs/                  # File storage buckets
│   ├── artifactregistry/     # Container images
│   ├── secrets/              # Secret Manager + IAM bindings
│   └── workload-identity/    # WIF for GitHub Actions OIDC
├── environments/
│   ├── dev/                  # europe-west1, minimal sizing
│   ├── staging/              # europe-west1, scaled-down prod
│   └── prod/                 # europe-west1, full HA
└── bootstrap/                # One-time GCS state bucket + initial SAs
```

## Bootstrap (one-time per env)

```bash
# Authenticate as project owner
gcloud auth login
gcloud auth application-default login
gcloud config set project resumaker-<env>

# Create the state bucket + base service accounts
cd infra/tofu/bootstrap
./bootstrap.sh <env>
```

## Apply

```bash
cd infra/tofu/environments/<env>
tofu init
tofu plan -out=plan.tfplan
tofu apply plan.tfplan
```

## Region

All environments live in **europe-west1 (Belgium)**. GCP does not yet have
GA in Israel, and europe-west1 is the closest region with full feature
coverage. Cloudflare sits in front of GKE for edge cache + DDoS, which
absorbs most of the ~30-50ms RTT penalty for Israeli end-users.

## State

Remote state is stored in GCS buckets — one per env (see each env's
`backend.tf`). State is versioned and encrypted with Google-managed keys.
