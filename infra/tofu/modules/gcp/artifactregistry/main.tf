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
      older_than = "604800s"
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
