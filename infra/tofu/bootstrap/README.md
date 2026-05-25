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
