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
