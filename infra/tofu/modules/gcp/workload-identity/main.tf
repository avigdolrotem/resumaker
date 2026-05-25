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
    "google.subject"           = "assertion.sub"
    "attribute.aud"            = "assertion.aud"
    "attribute.vercel_project" = "assertion.project_id"
    "attribute.vercel_env"     = "assertion.environment"
  }

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

resource "google_project_iam_member" "cicd_roles" {
  for_each = toset([
    "roles/artifactregistry.writer",
    "roles/container.developer",
  ])
  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.cicd.email}"
}
