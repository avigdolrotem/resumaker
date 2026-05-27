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

Next: cd ../environments/${ENV} && tofu init && tofu plan
EOF
