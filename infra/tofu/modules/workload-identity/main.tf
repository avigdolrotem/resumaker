locals {
  name_prefix = "resumaker-${var.env}"
}

# Pool that GitHub Actions federates into.
resource "google_iam_workload_identity_pool" "main" {
  project                   = var.project_id
  workload_identity_pool_id = "${local.name_prefix}-wif-pool"
  display_name              = "Resumaker ${var.env} WIF pool"
  description               = "Trusts GitHub Actions OIDC tokens."
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

  attribute_condition = "assertion.repository == \"${var.github_repo}\" && (assertion.ref == \"refs/heads/main\" || assertion.ref_type == \"tag\")"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# App service account — GKE pods run as this SA via Workload Identity.
resource "google_service_account" "app" {
  project      = var.project_id
  account_id   = "resumaker-app"
  display_name = "Resumaker Next.js app (GKE)"
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

resource "google_project_iam_member" "cicd_roles" {
  for_each = toset([
    "roles/artifactregistry.writer",
    "roles/container.developer",
  ])
  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

# GKE Workload Identity bindings on the app GSA.
#
# Two principalSets bind here:
#   1. resumaker/resumaker-app — the app pods themselves (Vertex AI,
#      Cloud SQL, Secret Manager direct reads, etc).
#   2. external-secrets/external-secrets — the ESO operator KSA, so
#      it can impersonate the app GSA to sync Secret Manager values
#      into the `resumaker-app` k8s Secret. Without this binding ESO
#      throws "iam.serviceAccounts.getAccessToken denied" when it
#      tries to assume the GSA from the external-secrets namespace.
resource "google_service_account_iam_member" "app_workload_identity_users" {
  for_each = toset([
    "serviceAccount:${var.project_id}.svc.id.goog[resumaker/resumaker-app]",
    "serviceAccount:${var.project_id}.svc.id.goog[external-secrets/external-secrets]",
  ])
  service_account_id = google_service_account.app.name
  role               = "roles/iam.workloadIdentityUser"
  member             = each.key
}
