output "repository_url" {
  description = "europe-west1-docker.pkg.dev/{project}/{repo}"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
}
