# GCP Migration — Design Spec

**Status:** Approved 2026-05-26
**Scope:** Track 1 of the Q2 roadmap. Cloud migration from AWS Tofu (dormant) to GCP for the launch window, funded by the $300 GCP free trial.
**Roadmap reference:** `/Users/server/.claude/plans/floofy-twirling-thompson.md` (Track 1).

## 1. Overview

### What we're building

Provision a complete GCP environment for Resumaker — VPC + GKE Autopilot + Cloud SQL Postgres + Memorystore Redis + Artifact Registry + Secret Manager + GKE Ingress + Workload Identity Federation — across three environments (`dev`, `staging`, `prod`) in `europe-west1` (Belgium). The Next.js frontend stays on Vercel; GKE is provisioned but mostly idle until Track 2 (the Jobs platform) fills it with scrapers and workers. Vercel app connects to Cloud SQL via the Cloud SQL Connector npm library using IAM auth.

### Why

1. **Vercel + Neon won't carry production load** — no way to run long-running scrapers, batch fit-scoring, or anything Vercel's 60s function limit blocks.
2. **The $300 trial is launch runway** — covers ~2 months of full-tier infra including the most critical onboarding+marketing window.
3. **AWS Tofu was written but never applied** — we have ~6 functional modules (network, eks, rds, elasticache, s3, ecr) describing the AWS shape, so the rewrite-as-GCP work is mostly mechanical.
4. **Israel-specific region (`il-central-1` on AWS) is not free-trial eligible** — Belgium is the next best (~30-50ms RTT penalty for Israeli users), absorbed by Cloudflare's edge in front anyway.

### Out of scope

- Migrating data from Neon to Cloud SQL — there is no real user data yet (one dev test account). Start fresh on Cloud SQL at launch.
- Building scrapers / Jobs platform workers (Track 2).
- Hebrew benchmark + multi-AI model picker (Track 3 — already shipped in 3A; 3B/3C separate).
- Decommissioning AWS modules — they stay in-repo as dormant fallback. No AWS resources have ever been applied.
- Changing the cron strategy — Vercel cron stays for v1, even after GKE exists. Track 2 introduces the Vercel-cron-triggers-GKE-worker pattern.

## 2. Decisions Locked In

From the brainstorming session (2026-05-26):

| Decision                        | Value                                                                | Rationale                                                                                          |
| ------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| GCP project structure           | One project per env (`resumaker-dev`, `-staging`, `-prod`)           | Clean isolation, matches AWS env shape, easy to nuke non-prod                                      |
| Region                          | `europe-west1` (Belgium)                                             | Free-trial eligible, closest to Israel after `il-central-1` (which isn't trial-eligible)           |
| Envs to provision               | All three (dev / staging / prod)                                     | Per AWS parity; lets us validate Tofu in dev before applying prod                                  |
| Data migration                  | Greenfield — Cloud SQL starts empty                                  | No real users yet; dump-and-restore would just move a test account                                 |
| GKE workloads in Track 1        | Cluster + operators only (ArgoCD, ExternalSecrets, cert-mgr)         | Functional workloads come with Track 2; cluster is idle until then                                 |
| AWS modules                     | Stay in-repo, dormant                                                | Cheap insurance; non-zero chance we'd want to fall back to AWS post-launch                         |
| Vercel hosting                  | Keep for the Next.js frontend                                        | Edge caching, preview deploys, vercel.json cron all $0 — we only need GCP for what Vercel can't do |
| Cron strategy in v1             | Stay on Vercel                                                       | No GKE workloads yet to receive triggers — no point switching                                      |
| Module layout                   | Parallel GCP modules at `infra/tofu/modules/gcp/*`                   | Side-by-side with AWS modules; keeps dormant code untouched                                        |
| State backend                   | One GCS bucket per project (`gs://resumaker-{env}-tfstate`)          | Blast-radius isolation; state corruption stays scoped                                              |
| Bootstrap                       | Manual `gcloud` script for projects + billing + APIs + state buckets | Avoids Tofu-managing-its-own-state-backend chicken-and-egg                                         |
| Vercel ↔ Cloud SQL connectivity | Cloud SQL Connector (npm) + IAM auth via Vercel OIDC                 | Modern best practice; ephemeral certs handled by the connector; no static creds in Vercel          |

## 3. Architecture

### Service mapping (AWS → GCP)

| AWS module                       | GCP equivalent                                                   | New module path                          |
| -------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `network` (VPC + NAT + subnets)  | VPC + Cloud NAT + private subnet for Cloud SQL VPC peering       | `modules/gcp/network`                    |
| `eks` (EKS + node group)         | GKE Autopilot                                                    | `modules/gcp/gke`                        |
| `rds` (Postgres)                 | Cloud SQL Postgres (15)                                          | `modules/gcp/cloudsql`                   |
| `elasticache` (Redis)            | Memorystore Redis 7 (Basic tier)                                 | `modules/gcp/memorystore`                |
| `s3` (buckets, currently unused) | GCS buckets — module defined but no buckets created until needed | `modules/gcp/gcs`                        |
| `ecr` (image registry)           | Artifact Registry (Docker repo)                                  | `modules/gcp/artifactregistry`           |
| AWS Secrets Manager              | Secret Manager + ExternalSecrets operator                        | `modules/gcp/secrets`                    |
| ALB ingress controller           | GKE Ingress (Google Cloud Load Balancing)                        | (Helm values change, no new Tofu module) |
| IAM + IRSA                       | Workload Identity Federation + GCP service accounts              | `modules/gcp/workload-identity`          |

### Network topology

- One VPC per project, `10.{0,1,2}.0.0/16` for dev/staging/prod respectively (avoids overlap if we ever peer them, e.g. for shared monitoring).
- Public subnet for the GKE Ingress LB + Cloud NAT.
- Private subnet for GKE nodes (Autopilot manages these automatically; we just supply CIDR).
- Allocated private services range for Cloud SQL + Memorystore VPC peering.
- Cloud SQL has a public IP **and** private IP; public IP gated by Cloud SQL Connector IAM auth, private IP for in-cluster workloads.

### Identity & secrets

- One GCP service account per workload-role per env (`resumaker-app@`, `resumaker-cron@`, `resumaker-worker@`).
- Workload Identity Federation pool trusts:
  - GitHub Actions OIDC (for CI/CD) — repo+branch claim binding.
  - Vercel OIDC (for runtime DB connections from the Next.js app) — project+env claim binding.
- ExternalSecrets operator runs in-cluster, syncs from Secret Manager to K8s Secrets on a schedule. Uses Workload Identity binding to authenticate.
- Bootstrap secrets (initial DB password, gateway API keys) loaded into Secret Manager by the `gcloud` bootstrap script; everything afterward managed via Terraform `google_secret_manager_secret`.

### Vercel ↔ Cloud SQL

Vercel's Next.js app authenticates to Cloud SQL using IAM + the Cloud SQL Connector library:

```ts
import { Connector } from '@google-cloud/cloud-sql-connector';
import postgres from 'postgres';

const connector = new Connector();
const clientOpts = await connector.getOptions({
  instanceConnectionName: env.GCP_CLOUD_SQL_INSTANCE, // "resumaker-prod:europe-west1:resumaker-pg"
  ipType: 'PUBLIC',
  authType: 'IAM',
});

const sql = postgres({
  ...clientOpts,
  database: 'resumaker',
  user: env.GCP_CLOUD_SQL_IAM_USER, // "resumaker-app@resumaker-prod.iam"
  max: 10,
});
```

Vercel mints an OIDC token (built-in `VERCEL_OIDC_TOKEN`), exchanges it for short-lived GCP credentials via Workload Identity Federation, and the Cloud SQL Connector uses those to authenticate. No long-lived DB password in Vercel env vars.

For the local dev experience, the same code path works via the developer's `gcloud auth application-default login` credentials.

## 4. Module Structure

### New files

```
infra/tofu/
├── bootstrap/
│   ├── README.md                 # gcloud script: project create, APIs enable, state buckets
│   └── bootstrap.sh
└── modules/gcp/
    ├── network/                  # VPC + NAT + subnets + private services range
    ├── gke/                      # GKE Autopilot cluster + workload identity setup
    ├── cloudsql/                 # Cloud SQL Postgres + IAM users + DB grants
    ├── memorystore/              # Redis 7 Basic tier
    ├── gcs/                      # GCS bucket factory (no buckets created yet)
    ├── artifactregistry/         # Docker repo for resumaker images
    ├── secrets/                  # Secret Manager secrets + IAM
    └── workload-identity/        # WIF pool + provider for GH Actions + Vercel
```

### New environments

```
infra/tofu/environments/
├── dev-gcp/
│   ├── main.tf                  # wires modules with dev-sized values
│   ├── backend.tf               # gs://resumaker-dev-tfstate
│   ├── providers.tf             # google + google-beta, eu-west1
│   ├── variables.tf
│   └── outputs.tf
├── staging-gcp/
│   └── ...                      # mirrors dev-gcp, scaled identically
└── prod-gcp/
    └── ...                      # production sizing
```

### Modified files

| File                                 | Change                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `infra/helm/resumaker/values.*.yaml` | New `values.{env}-gcp.yaml` for GKE Ingress annotations + GCP Secret Manager refs (paralleling existing AWS values) |
| `.github/workflows/deploy.yml`       | Add GCP path: `google-github-actions/auth`, Artifact Registry push, GKE kubectl context                             |
| `.github/workflows/infra.yml`        | Add `dev-gcp`/`staging-gcp`/`prod-gcp` matrix entries for Tofu plan/apply                                           |
| `apps/web/src/lib/env.ts`            | Add `GCP_PROJECT_ID`, `GCP_CLOUD_SQL_INSTANCE`, `GCP_CLOUD_SQL_IAM_USER` (all optional during transition)           |
| `apps/web/package.json`              | Add `@google-cloud/cloud-sql-connector`                                                                             |
| `apps/web/src/db/index.ts`           | When `GCP_CLOUD_SQL_INSTANCE` is set, use Cloud SQL Connector path; otherwise fall back to `DATABASE_URL` (Neon)    |

## 5. Bootstrap Sequence

A one-time `gcloud` script run by the operator (recorded in `infra/tofu/bootstrap/README.md`). Steps:

1. Create the 3 GCP projects under a billing account. Verify billing linkage.
2. Enable required APIs per project: compute, container, sqladmin, redis, secretmanager, artifactregistry, iamcredentials, iam.
3. Create GCS state bucket per project: `gs://resumaker-{env}-tfstate` with versioning + uniform bucket-level access.
4. Create a Tofu admin service account per project with `roles/owner` (will be scoped down later).
5. Output the bootstrap context (project IDs, SA emails, state bucket names) to `infra/tofu/bootstrap/.context.txt` (gitignored).

After bootstrap, Tofu owns everything else.

## 6. Apply Sequence

Order matters because later modules depend on earlier ones via outputs.

```
1. network        (VPC, subnets, NAT, private services range)
2. cloudsql       (depends on network)
3. memorystore    (depends on network)
4. artifactregistry (independent)
5. secrets        (independent)
6. workload-identity (independent — sets up WIF pools)
7. gke            (depends on network + secrets + workload-identity)
```

After all 7 land in `dev-gcp`, we validate (see §9), then apply to `staging-gcp` (mostly a re-run with different vars), then `prod-gcp`.

## 7. CI/CD Changes

### `.github/workflows/deploy.yml`

Add a parallel path (don't replace AWS path):

- `BUILD_TARGET=gcp` matrix dimension.
- For `gcp`: use `google-github-actions/auth@v2` with WIF, push image to `europe-west1-docker.pkg.dev/resumaker-{env}/resumaker/web:<sha>`.
- Bump `infra/helm/resumaker/values.{env}-gcp.image.yaml` instead of `.values.{env}.image.yaml`.
- ArgoCD on the GKE cluster watches the same `main` branch but a different values file.

### `.github/workflows/infra.yml`

Add matrix entries: `dev-gcp`, `staging-gcp`, `prod-gcp`. Same `tofu fmt` / `plan` / `apply` flow as AWS entries, just different working directory and provider auth.

## 8. Vercel Integration

### Env vars to add (Vercel side)

- `GCP_PROJECT_ID` — `resumaker-prod` etc.
- `GCP_CLOUD_SQL_INSTANCE` — `resumaker-prod:europe-west1:resumaker-pg`
- `GCP_CLOUD_SQL_IAM_USER` — `resumaker-app@resumaker-prod.iam`
- `GCP_WIF_PROVIDER` — full resource name of the WIF provider
- `GCP_WIF_SERVICE_ACCOUNT` — email of the SA Vercel impersonates

### App-side connection switch

`apps/web/src/db/index.ts` reads `GCP_CLOUD_SQL_INSTANCE`. If set, uses the Cloud SQL Connector + WIF auth; otherwise falls back to the Neon `DATABASE_URL` (unchanged today). This lets us flip per-env via Vercel project settings — no code redeploy needed.

### Cutover plan

On launch day:

1. Verify `prod-gcp` is fully applied + healthy (Cloud SQL reachable, GKE green, secrets synced).
2. Run schema migrations against the empty Cloud SQL via `pnpm db:migrate` from a developer machine authenticated to prod.
3. In the Vercel prod project, set `GCP_CLOUD_SQL_INSTANCE` (and the WIF env vars). Trigger redeploy.
4. App starts pointing at Cloud SQL. Neon DB stops receiving writes.
5. Smoke test: signup, generate a resume, log out, log in. Verify rows landing in Cloud SQL via `gcloud sql connect`.
6. After 7 days clean, suspend the Neon project. Don't delete — keep as fallback for 30 days.

## 9. Verification

For each env, after `tofu apply` completes:

- `tofu plan` against the same env produces a clean diff (no drift).
- `kubectl get nodes` (via gke-gcloud-auth-plugin) shows Autopilot-managed nodes.
- `gcloud sql connect resumaker-pg --user=resumaker-app --project=resumaker-{env}` succeeds with IAM auth.
- `gcloud redis instances describe resumaker-redis --region=europe-west1 --project=resumaker-{env}` shows READY.
- ArgoCD UI accessible via port-forward; shows the seeded apps as Synced.
- ExternalSecrets operator: kubectl describe pod shows it reading from Secret Manager.
- Workload Identity test: `kubectl run --rm -it --image=google/cloud-sdk:slim --serviceaccount=resumaker-app testpod -- gcloud auth list` shows the SA impersonated successfully.
- End-to-end: deploy a "hello, world" workload via ArgoCD, expose via GKE Ingress, hit it from outside, get 200.

For prod cutover specifically:

- Vercel preview deploy with the new env vars succeeds (proves the Connector path works).
- Production deploy: smoke-test signup + resume generation against Cloud SQL.

## 10. Costs

| Resource (per env)                        | Est. monthly cost |
| ----------------------------------------- | ----------------- |
| GKE Autopilot (idle, ~0.25 vCPU baseline) | $30-50            |
| Cloud SQL Postgres (db-g1-small)          | $35-45            |
| Memorystore Redis (1GB Basic)             | $25               |
| Cloud NAT + egress                        | $5-15             |
| Artifact Registry + GCS                   | $1-5              |
| **GCP subtotal per env**                  | **~$95-140/mo**   |

For 3 envs running simultaneously: ~$285-420/mo. The $300 trial covers ~1 month of all three, OR ~2-3 months of just prod. Strategy: apply all three for the launch window (validates IaC), keep dev/staging running long enough to confirm prod is stable, then suspend non-prod resources to extend the trial. Suspending Cloud SQL + Memorystore instances retains the data and config but stops compute billing.

Plus, unchanged: Vercel (Hobby, free), Cloudflare (~$20/mo), Anthropic/Gateway (variable).

## 11. Risks & Rollback

### Risk: Trial credits burn faster than expected

Mitigation: alert on 50%/75%/90% credit usage via GCP Budget alerts (set up in bootstrap). If credits are projected to run out before revenue signal, suspend non-prod resources first, prod last.

### Risk: WIF / Cloud SQL IAM auth doesn't work from Vercel

This is the most novel piece of the stack. Mitigation: validate end-to-end from a Vercel preview deploy BEFORE prod cutover. If it doesn't work, fallback: Cloud SQL with public IP + strong password in Vercel env var + `authorized_networks` allowlist (lower security, well-understood pattern).

### Risk: GKE Autopilot has constraints we hit later

Autopilot restricts privileged pods, host networking, custom node images, and some kernel-tuning. If Track 2's scrapers need any of those, we'd have to convert to GKE Standard. Mitigation: design Track 2 workloads to be Autopilot-compatible. If forced, conversion is a single Tofu module swap (Standard cluster type), keeping the rest of the infra intact.

### Risk: Drizzle schema drift carries over

The drizzle snapshot drift (from migrations 0006-0016) is an existing problem; provisioning a new Cloud SQL doesn't fix it. Track 1 inherits this hazard. Mitigation: fix the drift (chip already queued) before running migrations against Cloud SQL.

### Rollback

- **Pre-cutover:** revert the Vercel env vars; app keeps using Neon. Tofu state in GCS stays intact for re-apply.
- **Post-cutover, within 7 days:** set the Vercel env vars back to the Neon path. Cloud SQL data loss is acceptable (no real users yet). Investigate, fix, redo cutover.
- **AWS revival (last resort):** the dormant AWS modules can be applied from scratch. ~1-2 day setup. Has never been done; not the first option.

## 12. Success Criteria

This rework is done when all of these are true:

1. `tofu apply` succeeds cleanly against `dev-gcp`, `staging-gcp`, and `prod-gcp` from a fresh state.
2. ArgoCD on the prod GKE cluster shows at least one application synced (even if it's just a hello-world).
3. The Vercel prod app, with `GCP_CLOUD_SQL_INSTANCE` set, can read/write Cloud SQL using IAM auth.
4. A signup + resume generation smoke test passes end-to-end against prod Cloud SQL.
5. GCP Budget alerts are configured for each project.
6. Documentation: `infra/tofu/bootstrap/README.md` + `infra/tofu/modules/gcp/README.md` are written and accurate enough for a future operator to redo the bootstrap.

## 13. Open Questions (none)

All major architectural choices are settled per §2. The brainstorming session resolved every blocker. Implementation details (specific module variable shapes, IAM role bindings, helm value structures) will be settled in the implementation plan.
